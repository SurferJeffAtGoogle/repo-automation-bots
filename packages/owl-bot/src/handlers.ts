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

import { OwlBotLock } from "./config-files";
import { findReposWithPostProcessor, Configs, Db } from "./database";
import {Octokit} from '@octokit/rest';
import {exec} from "child_process";

export async function onPostProcessorPublished(db: Db, 
  dockerImageName: string,
  dockerImageDigest: string): Promise<void>
{
  // Examine all the repos that use the specified docker image for post 
  // processing.
  let repos: [string, Configs][] =
    await findReposWithPostProcessor(db, dockerImageName);
  for (const [repo, configs] of repos) {
    let stale = true;
    // The lock file may be missing, for example when a new repo is created.
    try {
      stale = configs.lock!.docker.digest != dockerImageDigest;
    } catch (e) {
      console.log(repo + " did not have a valid .OwlBot.yaml.lock file.");
    }
    if (stale) {
      const lock: OwlBotLock = {
        docker: {
          digest: dockerImageDigest,
          image: dockerImageName
        }
      };
      createOnePullRequestForUpdatingLock(db, repo, lock);
    }
  }
}

async function createOnePullRequestForUpdatingLock(db: Db, octokit: Octokit,
  installationId:number, repo: string,  lock: OwlBotLock): Promise<string>
{
  const existingPullRequest = findPullRequestForUpdatingLock(db, repo, lock);
  if (existingPullRequest) {
    return existingPullRequest;
  }
  // Clone the repo.
  
}
