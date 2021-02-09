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
import {OwlBotLock, owlBotLockFrom, owlBotLockPath, owlBotYamlFrom, owlBotYamlPath} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {OctokitType} from './core';
import {Octokit, RestEndpointMethodTypes} from '@octokit/rest';
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
 * @param db: database
 * @param octokit Octokit.
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param orgInstallationId the installation id of the github app.
 *   Won't need to be specified in production once the database has recorded
 *   the installation id for any repo in the org.
 */
export async function scanGithubForConfigs(configsStore: ConfigsStore,
    octokit: OctokitType, githubOrg: string, orgInstallationId?: number,
    logger=console): Promise<void>
{
  // Some configurations may not have an installationId yet.
  // TODO: Revisit them after we have collected an installationId.
  const configsWithoutInstallationIds: [unknown, Configs?][] = [];

  // TODO: traverse pages returned by listForOrg().
  const { data: repoData } = await octokit.repos.listForOrg({org: githubOrg});
  for (const repo of repoData) {

    // Load the current configs from the db.
    const configs = await configsStore.getConfigs(repo.full_name);

    // Observe the installationId.
    const installationId = configs?.installationId ?? orgInstallationId;
    if (!installationId) {
      configsWithoutInstallationIds.push([repoData, configs]);
      continue;
    } else if (!orgInstallationId) {
      orgInstallationId = installationId;
    } else if (installationId !== configs?.installationId) {
      logger.warn(`Saw two different installation ids for ${githubOrg}: \
        ${installationId} !== ${configs?.installationId}`);
    }

    // Query github for the commit hash of the default branch.
    const defaultBranch = repo.default_branch ?? 'master';
    const { data: branchData } = await octokit.repo.branch.get({branchName: defaultBranch});
    const commitHash = branchData.commit.sha;

    if (configs?.commitHash === commitHash && configs?.branchName === defaultBranch) {
      continue;  // configsStore is up to date.
    }

    // Update the configs.
    const newConfigs: Configs = {
      branchName: defaultBranch,
      installationId: installationId,
      commitHash: commitHash,
    };

    // Query github for the contents of the lock file.
    const {data: lockData} = await octokit.repos.getContent({
      owner: githubOrg,
      repo: repo.name,
      path: owlBotLockPath,
      ref: commitHash
    });
    if (lockData.content) {
      try {
        const text = Buffer.from(lockData.content, 'base64').toString();
        newConfigs.lock = owlBotLockFrom(yaml.load(text) as Record<string, any>);
      } catch (e) {
        console.error(`${repo.full_name} has an invalid ${owlBotLockPath} file: ${e}`);
      }
    }

    // Query github for the contents of the yaml file.
    const {data: configData} = await octokit.repos.getContent({
      owner: githubOrg,
      repo: repo.name,
      path: owlBotYamlPath,
      ref: commitHash
    });
    if (configData.content) {
      try {
        const text = Buffer.from(configData.content, 'base64').toString();
        newConfigs.yaml = owlBotYamlFrom(yaml.load(text) as Record<string, any>);
      } catch (e) {
        console.error(`${repo.full_name} has an invalid ${owlBotYamlPath} file: ${e}`);
      }
    }

    // Store the new configs back into the database.
    const stored = await configsStore.storeConfigs(repo.full_name, newConfigs,
      configs?.commitHash ?? null);
    if (!stored) {
      console.warn(`Mid-air collision!  ${repo.full_name}'s configs were already updated.`);
    }
  }  
}

