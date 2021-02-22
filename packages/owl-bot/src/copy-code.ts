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

import {OctokitType} from './core';

export interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  'source-repo': string;
  'source-repo-commit-hash': string;
  'dest-repo': string;
}

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
