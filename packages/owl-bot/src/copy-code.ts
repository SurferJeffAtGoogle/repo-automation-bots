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

import {OctokitType, getGitHubShortLivedAccessToken, core} from './core';
import { promisify } from 'util';
import { readFile } from 'fs';
import * as proc from 'child_process';
import { owlBotYamlPath, owlBotYamlFrom, OwlBotYaml } from './config-files';
import path from 'path';
import {load} from 'js-yaml';
import {v4 as uuidv4} from 'uuid';

const readFileAsync = promisify(readFile);

export interface Args extends OctokitParams{
  'source-repo': string;
  'source-repo-commit-hash': string;
  'dest-repo': string;
}

export interface OctokitParams {
    'pem-path': string;
    'app-id': number;
    installation: number;  
}

export async function octokitFrom(argv: OctokitParams): Promise<OctokitType> {
    const privateKey = await readFileAsync(argv['pem-path'], 'utf8');
    const token = await getGitHubShortLivedAccessToken(
      privateKey,
      argv['app-id'],
      argv.installation
    );
    return await core.getAuthenticatedOctokit(token.token);    
}

export function cmd(command: string, logger=console, options?: proc.ExecSyncOptionsWithStringEncoding | undefined): string {
    logger.info(command);
    return proc.execSync(command, options);
}

export async function copyCode(args: Args, logger=console): Promise<void> {
    if (await copyExists(await octokitFrom(args), args["dest-repo"], args["source-repo-commit-hash"])) {
        return;  // Copy already exists.  Don't copy again.
    }
    const workDir = ".";
    const sourceDir = path.join(workDir, "source");
    const destDir = path.join(workDir, "dest");
    const destBranch = "owl-bot-" + uuidv4();

    // Clone the two repos.
    cmd(`git clone --single-branch "https://${args["source-repo"]}.git" ${sourceDir}`, logger);
    cmd(`git clone --single-branch "https://${args["dest-repo"]}.git" ${destDir}`, logger);

    // Check out the specific hash we want to copy from.
    cmd(`git checkout ${args["source-repo-commit-hash"]}`, logger, {cwd: sourceDir, encoding: 'utf8'});

    // Check out a dest branch.
    cmd(`git checkout -b ${destBranch}`, logger, {cwd: destDir, encoding: 'utf8'});


    // Load the OwlBot.yaml file in dest.
    const yamlPath = path.join(destDir, owlBotYamlPath);
    let yaml: OwlBotYaml;
    try {
        const text = await readFileAsync(yamlPath, 'utf8');
        const obj = load(text);
        yaml = owlBotYamlFrom(obj as Record<string, any>);
    } catch (e) {
        logger.error(e);
        // TODO: open an issue on the dest repository.
        return;  // Success because we don't want to retry.
    }

    for (const copyDir of yaml["copy-dirs"] ?? []) {
        // Wipe out the existing contents of the dest directory.
        cmd(`rm -rf "${copyDir.dest}"`, logger, {cwd: destDir, encoding: 'utf8'});
        cmd(`mkdir -p "${copyDir.dest}"`, logger, {cwd: destDir, encoding: 'utf8'});                
    }
}

/**
 * Searches for instances of the sourceCommitHash in recent pull requests and commits.
 * 
 * @param octokit an octokit instance
 * @param destRepo the repo to search
 * @param sourceCommitHash the string to search for
 */
export async function copyExists(
  octokit: OctokitType,
  destRepo: string,
  sourceCommitHash: string,
  logger = console
): Promise<boolean> {
  const q = `repo:${destRepo}+${sourceCommitHash}`;
  const foundCommits = await octokit.search.commits({q});
  if (foundCommits.data.total_count > 0) {
    logger.info(`Commit with ${sourceCommitHash} exists in ${destRepo}.`);
    return true;
  }
  const found = await octokit.search.issuesAndPullRequests({q});
  for (const item of found.data.items) {
    logger.info(
      `Issue or pull request ${item.number} with ${sourceCommitHash} exists in ${destRepo}.`
    );
    return true;
  }
  // I observed octokit.search.issuesAndPullRequests() not finding recent, open
  // pull requests.  So enumerate them.
  const [owner, repo] = destRepo.split('/');
  const pulls = await octokit.pulls.list({owner, repo, per_page: 100});
  for (const pull of pulls.data) {
    const pos: number = pull.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Pull request ${pull.number} with ${sourceCommitHash} exists in ${destRepo}.`
      );
      return true;
    }
  }
  logger.info(`${sourceCommitHash} not found in ${destRepo}.`);
  return false;
}
