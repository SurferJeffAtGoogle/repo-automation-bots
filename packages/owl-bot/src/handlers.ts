// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {createPullRequest} from 'code-suggester';
import {dump} from 'js-yaml';
import {
  OwlBotLock,
  owlBotLockFrom,
  owlBotLockPath,
  owlBotYamlFrom,
  owlBotYamlPath,
} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {OctokitType, core } from './core';
import {Octokit} from '@octokit/rest';
import yaml from 'js-yaml';

/**
 * Invoked when a new pubsub message arrives because a new post processor
 * docker image has been published to Google Container Registry.
 * @param db: database
 * @param dockerImageName: the name of the docker image that was updated.
 *   example: "gcr.io/repo-automation-bots/nodejs-post-processor:latest"
 * @param dockerImageDigest: the new digest for the image.
 *   example: "sha256:1245151230998"
 */
export async function onPostProcessorPublished(
  configsStore: ConfigsStore,
  octokit: OctokitType,
  dockerImageName: string,
  dockerImageDigest: string,
  logger = console
): Promise<void> {
  // Examine all the repos that use the specified docker image for post
  // processing.
  const repos: [
    string,
    Configs
  ][] = await configsStore.findReposWithPostProcessor(dockerImageName);
  for (const [repo, configs] of repos) {
    let stale = true;
    // The lock file may be missing, for example when a new repo is created.
    try {
      stale = configs.lock!.docker.digest !== dockerImageDigest;
    } catch (e) {
      logger.log(repo + ' did not have a valid .OwlBot.yaml.lock file.');
    }
    if (stale) {
      const lock: OwlBotLock = {
        docker: {
          digest: dockerImageDigest,
          image: dockerImageName,
        },
      };
      // TODO(bcoe): switch updatedAt to date from PubSub payload:
      createOnePullRequestForUpdatingLock(
        configsStore,
        octokit,
        repo,
        lock,
        new Date()
      );
    }
  }
}

/**
 * Creates a pull request to update .OwlBot.lock.yaml, if one doesn't already
 * exist.
 * @param db: database
 * @param octokit: Octokit.
 * @param repoFull: full repo name like "googleapis/nodejs-vision"
 * @param lock: The new contents of the lock file.
 * @returns: the uri of the new or existing pull request
 */
export async function createOnePullRequestForUpdatingLock(
  configsStore: ConfigsStore,
  octokit: OctokitType,
  repoFull: string,
  lock: OwlBotLock,
  updatedAt: Date
): Promise<string> {
  const existingPullRequest = await configsStore.findPullRequestForUpdatingLock(
    repoFull,
    lock
  );
  if (existingPullRequest) {
    return existingPullRequest;
  }
  const [owner, repo] = repoFull.split('/');
  // createPullRequest expects file updates as a Map
  // of objects with content/mode:
  const changes = new Map();
  changes.set(owlBotLockPath, {
    content: dump(lock),
    mode: '100644',
  });
  // Opens a pull request with any files represented in changes:
  const prNumber = await createPullRequest(
    octokit as Octokit,
    changes,
    {
      upstreamOwner: owner,
      upstreamRepo: repo,
      // TODO(rennie): we should provide a context aware commit
      // message for this:
      title: 'chore: update OwlBot.lock with new version of post-processor',
      branch: 'owl-bot-lock-1',
      // TODO(bcoe): come up with a funny blurb to put in PRs.
      description: `Version ${
        lock.docker.digest
      } was published at ${updatedAt.toISOString()}.`,
      // TODO(rennie): we need a way to track what the primary branch
      // is for a PR.
      primary: 'main',
      force: true,
      fork: false,
      // TODO(rennie): we should provide a context aware commit
      // message for this:
      message: 'Update OwlBot.lock',
    },
    {level: 'error'}
  );
  const newPullRequest = `https://github.com/${repoFull}/pull/${prNumber}`;
  await configsStore.recordPullRequestForUpdatingLock(
    repoFull,
    lock,
    newPullRequest
  );
  return newPullRequest;
}

/**
 * Scans a whole github org for config files, and updates stale entries in
 * the config store.
 * @param configStore where to store config file contents
 * @param octokit Octokit
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param orgInstallationId the installation id of the github app.
 *   Won't need to be specified in production once the database has recorded
 *   the installation id for any repo in the org.
 */
export async function scanGithubForConfigs(
  configsStore: ConfigsStore,
  octokit: OctokitType,
  githubOrg: string,
  orgInstallationId?: number,
  logger = console
): Promise<void> {
  // Some configurations may not have an installationId yet.
  // Revisit them after we have collected an installationId.
  type refreshFunction = (installationId: number) => Promise<void>;
  const refreshLaters: refreshFunction[] = [];

  // TODO: traverse pages returned by listForOrg().
  const {data: repoData} = await octokit.repos.listForOrg({org: githubOrg});
  for (const repo of repoData) {
    // Load the current configs from the db.
    const repoFull = `${githubOrg}/${repo.name}`;
    const configs = await configsStore.getConfigs(repoFull);
    const defaultBranch = repo.default_branch ?? 'master';

    // Compose the refresh function.
    const refresh = (installationId: number) => {
      return refreshConfigs(
        configsStore,
        configs,
        octokit,
        githubOrg,
        repo.name,
        defaultBranch,
        installationId
      );
    };

    // Observe the installationId.
    if (configs?.installationId) {
      if (!orgInstallationId) {
        orgInstallationId = configs.installationId;
      } else if (orgInstallationId !== configs.installationId) {
        logger.warn(`Saw two different installation ids for ${repoFull}: \
        ${orgInstallationId} !== ${configs.installationId}`);
      }
      // Refresh now.
      await refresh(configs.installationId);
    } else {
      // Can't refresh yet because we don't have an installationId.
      refreshLaters.push(refresh);
    }
  }
  if (refreshLaters.length > 0) {
    if (!orgInstallationId) {
      logger.error(`No installation id found for ${githubOrg}.`);
    } else {
      for (const refresh of refreshLaters) {
        await refresh(orgInstallationId);
      }
    }
  }
}


/**
 * If the configs in the repo are newer than the configs in the configStore,
 * update the configStore.
 * @param configStore where to store config file contents
 * @param configs the configs recently fetch from the configStore; may be
 *   undefined if there were no configs in the configStore.
 * @param octokit Octokit
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param repoName the name of the repo; ex: "nodejs-vision".
 * @param defaultBranch the name of the repo's default branch; ex: "main"
 * @param installationId the installation id of the github app.
 */
export async function refreshConfigs(
  configsStore: ConfigsStore,
  configs: Configs | undefined,
  octokit: OctokitType,
  githubOrg: string,
  repoName: string,
  defaultBranch: string,
  installationId: number,
  logger=console
): Promise<void> {

  // Query github for the commit hash of the default branch.
  const {data: branchData} = await octokit.repo.branch.get({
    branchName: defaultBranch,
  });
  const commitHash = branchData.commit.sha;
  const repoFull = `${githubOrg}/${repoName}`;
  if (
    configs?.commitHash === commitHash &&
    configs?.branchName === defaultBranch
  ) {
    logger.info(`Configs for ${repoFull} or up to date.`);
    return; // configsStore is up to date.
  }

  // Update the configs.
  const newConfigs: Configs = {
    branchName: defaultBranch,
    installationId: installationId,
    commitHash: commitHash,
  };

  // Query github for the contents of the lock file.
  const lockContent = await core.getFileContent(
    githubOrg,
    repoName,
    owlBotLockPath,
    commitHash,
    octokit
  );
  if (lockContent) {
    try {
      newConfigs.lock = owlBotLockFrom(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yaml.load(lockContent) as Record<string, any>
      );
    } catch (e) {
      logger.error(`${repoFull} has an invalid ${owlBotLockPath} file: ${e}`);
    }
  }

  // Query github for the contents of the yaml file.
  const yamlContent = await core.getFileContent(
    githubOrg,
    repoName,
    owlBotYamlPath,
    commitHash,
    octokit
  );
  if (yamlContent) {
    try {
      newConfigs.yaml = owlBotYamlFrom(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yaml.load(yamlContent) as Record<string, any>
      );
    } catch (e) {
      logger.error(`${repoFull} has an invalid ${owlBotYamlPath} file: ${e}`);
    }
  }
  // Store the new configs back into the database.
  const stored = await configsStore.storeConfigs(
    repoFull,
    newConfigs,
    configs?.commitHash ?? null
  );
  if (stored) {
    logger.info(`Stored new configs for ${repoFull}`);
  } else {
    logger.info(
      `Mid-air collision! ${repoFull}'s configs were already updated.`
    );
  }
}
