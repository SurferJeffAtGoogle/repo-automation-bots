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

import tmp from 'tmp';
import * as assert from 'assert';
import {describe, it} from 'mocha';
import {scanGoogleapisGenAndCreatePullRequests} from '../src/scan-googleapis-gen-and-create-pull-requests';
import {newCmd} from '../src/copy-code';
import {makeDirTree} from './dir-tree';
import {FakeConfigsStore} from './fake-configs-store';
import {OctokitParams, OctokitFactory, OctokitType} from '../src/octokit-util';
import {OwlBotYaml} from '../src/config-files';

describe('scanGoogleapisGenAndCreatePullRequests', () => {
  function makeAbcRepo(): string {
    // Create a git repo.
    const dir = tmp.dirSync().name;
    const cmd = newCmd();
    cmd('git init', {cwd: dir});

    // Add 3 commits
    makeDirTree(dir, ['a.txt:1']);
    cmd('git add -A', {cwd: dir});
    cmd('git commit -m a', {cwd: dir});

    makeDirTree(dir, ['b.txt:2']);
    cmd('git add -A', {cwd: dir});
    cmd('git commit -m b', {cwd: dir});

    makeDirTree(dir, ['c.txt:3']);
    cmd('git add -A', {cwd: dir});
    cmd('git commit -m c', {cwd: dir});
    return dir;
  }

  const abcRepo = makeAbcRepo();

  it('does nothing with zero repos affected', async () => {
    const configsStore = new FakeConfigsStore();
    assert.strictEqual(
      await scanGoogleapisGenAndCreatePullRequests(
        abcRepo,
        {} as OctokitFactory,
        configsStore
      ),
      0
    );
  });

  function factory(octokit: any): OctokitFactory {
      return {
        getGitHubShortLivedAccessToken(): Promise<string> {
            return Promise.resolve("fake-token")
        },
        getShortLivedOctokit(token?: string): Promise<OctokitType> {
            return Promise.resolve(octokit as OctokitType);
        }
      };
  }

  const aYaml: OwlBotYaml = {
    'deep-copy-regex': [
      {
        source: '/a.txt',
        dest: '/src/a.txt',
        'rm-dest': '',
      },
    ],
  };

  const configsStoreWithAYaml = new FakeConfigsStore(
    new Map([
      [
        'googleapis/nodejs-vision',
        {
          branchName: 'main',
          commitHash: '456',
          installationId: 42,
          yaml: aYaml,
        },
      ],
    ])
  );

  it('does nothing when a pull request already exists', async () => {
    const octokit = ({
        search: {
          commits() {
            return { data: ["yes"]};
          },
        }
    });

    assert.strictEqual(
      await scanGoogleapisGenAndCreatePullRequests(
        abcRepo,
        factory(octokit),
        configsStoreWithAYaml
      ),
      0
    );
  });
});