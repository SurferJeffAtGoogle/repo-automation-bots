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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import path from 'path';
import * as fs from 'fs';
import tmp from 'tmp';
import {OwlBotYaml} from '../src/config-files';
import {collectDirTree, makeDirTree} from './dir-tree';
import {makeAbcRepo, makeRepoWithOwlBotYaml} from './make-repos';
import {newCmd} from '../src/cmd';
import { maybeCreatePullRequestForLockUpdate } from '../src/update-lock';
import { OctokitFactory } from '../src/octokit-util';
import { githubRepoFromOwnerSlashName } from '../src/github-repo';

describe('maybeCreatePullRequestForLockUpdate', () => {
  it('does nothing when no files changed', async () => {
    const repoDir = makeAbcRepo();
    await maybeCreatePullRequestForLockUpdate({} as OctokitFactory, 
      githubRepoFromOwnerSlashName("googleapis/nodejs-speech"), repoDir);
  });
});
