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
import { findReposWithPostProcessor, Configs } from "./database";

export async function onPostProcessorPublished(dockerImageName: string,
  dockerImageDigest: string): Promise<void>
{
  // Examine all the repos that use the specified docker image for post 
  // processing.
  let repos: [string, Configs][] =
    await findReposWithPostProcessor(db, dockerImageName);
  for (const [repo, configs] of repos) {
    let stale = true;
    try {  // The lock file may be missing.
      stale = configs.lock!.docker.digest != dockerImageDigest;
    } catch (e) {
      // This will happen when repos are first created.  It's ok, but worth
      // noting.
      console.log(repo + " did not have a valid .OwlBot.yaml.lock file.");
    }
    if (stale) {
      // Kick off a build to see if 
      const buildExists = await findBuildForUpdatingImageDigest(db, repo,
        dockerImageName, dockerImageDigest);
      if (!buildExists) {
        const buildId = await createBuildForUpdatingImageDigest(repo,
          dockerImageDigest, dockerImageDigest);
        await recordBuildForUpdatingImageDigest(db, repo, dockerImageName,
          dockerImageDigest, buildId);
      }
    }
  }
}

export async function onBuildForUpdatingImageDigestComplete(repo: string,
  repoCommithash: string, dockerImageName: string, dockerImageDigest: string,
  buildSucceeded: boolean, buildProducedChanges: boolean): Promise<void>
{
  if (buildProducedChanges) {
    
  }
}