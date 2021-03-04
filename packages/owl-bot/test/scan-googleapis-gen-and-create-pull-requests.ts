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
import {describe, it, afterEach} from 'mocha';
import { scanGoogleapisGenAndCreatePullRequests } from '../src/scan-googleapis-gen-and-create-pull-requests';
import { newCmd } from '../src/copy-code';
import { makeDirTree } from './dir-tree';
import { FakeConfigsStore } from './fake-configs-store';
import { OctokitParams } from '../src/octokit-util';

describe('scanGoogleapisGenAndCreatePullRequests', () => {
    it('works', async () => {
        // Create a git repo.        
        const dir = tmp.dirSync().name;
        const cmd = newCmd();
        cmd('git init', {cwd: dir});

        // Add 3 commits
        makeDirTree(dir, ["a.txt:1"]);
        cmd('git add -A', {cwd: dir});
        cmd('git commit -m a', {cwd: dir});
    
        makeDirTree(dir, ["b.txt:2"]);
        cmd('git add -A', {cwd: dir});
        cmd('git commit -m b', {cwd: dir});

        makeDirTree(dir, ["c.txt:3"]);
        cmd('git add -A', {cwd: dir});
        cmd('git commit -m c', {cwd: dir});

        const configsStore = new FakeConfigsStore();
        const octokitParams: OctokitParams = {
            "app-id": 4,
            "installation": 5,
            "pem-path": "/no/where"
        };
        await scanGoogleapisGenAndCreatePullRequests(dir, octokitParams, configsStore);
    })
});
