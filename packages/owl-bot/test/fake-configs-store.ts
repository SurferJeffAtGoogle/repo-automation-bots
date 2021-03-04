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
import {Configs, ConfigsStore} from '../src/configs-store';
import { OwlBotLock } from '../src/config-files';

export class FakeConfigsStore implements ConfigsStore {
    readonly configs: Map<string, Configs>;
  
    constructor(configs?: Map<string, Configs>) {
      this.configs = configs ?? new Map<string, Configs>();
    }
    findReposAffectedByFileChanges(
      changedFilePaths: string[]
    ): Promise<string[]> {
      throw new Error('Method not implemented.');
    }
  
    getConfigs(repo: string): Promise<Configs | undefined> {
      return Promise.resolve(this.configs.get(repo));
    }
  
    storeConfigs(
      repo: string,
      configs: Configs,
      replaceCommithash: string | null
    ): Promise<boolean> {
      const existingCommitHash = this.configs.get(repo)?.commitHash ?? null;
      if (existingCommitHash === replaceCommithash) {
        this.configs.set(repo, configs);
        return Promise.resolve(true);
      } else {
        return Promise.resolve(false);
      }
    }
  
    findReposWithPostProcessor(
      dockerImageName: string
    ): Promise<[string, Configs][]> {
      throw new Error('Method not implemented.');
    }
    findPullRequestForUpdatingLock(
      repo: string,
      lock: OwlBotLock
    ): Promise<string | undefined> {
      throw new Error('Method not implemented.');
    }
    recordPullRequestForUpdatingLock(
      repo: string,
      lock: OwlBotLock,
      pullRequestId: string
    ): Promise<string> {
      throw new Error('Method not implemented.');
    }
  }
  