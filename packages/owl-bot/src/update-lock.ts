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
import {newCmd} from './cmd';
import {core} from './core';
import {createPullRequestFromLastCommit} from './create-pr';
import { githubRepoFromUri } from './github-repo';
import {OctokitFactory} from './octokit-util';

export async function maybeCreatePullRequestForLockUpdate(
  octokitFactory: OctokitFactory,
  logger = console
): Promise<void> {
  const cmd = newCmd(logger);
  const status = cmd('git status --porcelain').toString('utf8');
  if (status) {
    // Commit additional changes.
    cmd('git add -A');
    cmd('git commit --amend --no-edit');

    // Create credentials.
    const token = await octokitFactory.getGitHubShortLivedAccessToken();

    // Create the pull request.
    const uri = cmd('git remote get-url origin').toString('utf8').trim();
    const githubRepo = githubRepoFromUri(uri);
    const branch = cmd('git branch --show-current').toString('utf8').trim();
    const octokit = await octokitFactory.getShortLivedOctokit(token);
    await createPullRequestFromLastCommit(
      githubRepo.owner,
      githubRepo.repo,
      '.',
      branch,
      githubRepo.getCloneUrl(token),
      [core.UPDATE_LOCK_PULL_REQUEST_LABEL],
      octokit,
      logger
    );
  } else {
      logger.log(`The post processor made no changes; I won't create a pull request.`);
  }
}
