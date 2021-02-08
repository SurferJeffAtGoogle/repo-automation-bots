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

import { OwlBotLock, OwlBotYaml } from './config-files';

export interface Configs {
  // The body of .Owlbot.lock.yaml.
  lock: OwlBotLock | undefined;
  // The body of .Owlbot.yaml.
  yaml: OwlBotYaml | undefined;
  // The commit hash from which the config files were retrieved.
  commithash: string;
  // The installation id for our github app and this repo.
  installationId: number;
}

export interface ConfigsStore {
    // Returns a list of [repo-name, config].
    findReposWithPostProcessor(
      dockerImageName: string
    ): Promise<[string, Configs][]>;
  
    /**
     * Finds a previously recorded pull request or returns undefined.
     * @param repo: full repo name like "googleapis/nodejs-vision"
     * @param lock: The new contents of the lock file.
     * @returns: the string passed to recordPullRequestForUpdatingLock().
     */
    findPullRequestForUpdatingLock(
      repo: string,
      lock: OwlBotLock
    ): Promise<string | undefined>;
  
    /**
     * Finds a previously recorded pull request or returns undefined.
     * @param repo: full repo name like "googleapis/nodejs-vision"
     * @param lock: The new contents of the lock file.
     * @param pullRequestId the string that will be later returned by
     *  findPullRequestForUpdatingLock().
     * @returns pullRequestId, which may differ from the argument if there
     *   already was a pull request recorded.
     *   In that case, the caller should close the pull request they
     *   created, to avoid annoying maintainers with duplicate pull requests.
     */
    recordPullRequestForUpdatingLock(
      repo: string,
      lock: OwlBotLock,
      pullRequestId: string
    ): Promise<string>;
  }
  