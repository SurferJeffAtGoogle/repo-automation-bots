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

import {describe, it, before} from 'mocha';
import admin from 'firebase-admin';
import { FirestoreConfigsStore } from '../src/database';
import {Configs } from '../src/configs-store';
import { v4 as uuidv4 } from 'uuid';
import * as assert from 'assert';

describe('database', () => {
  before(function () {
  });

  it('works', async () => {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    const db = admin.firestore();
    const store = new FirestoreConfigsStore(db, "test-");
    const repo = "googleapis/" + uuidv4();
    const dockerImage = uuidv4();

    // Confirm that the new repo and dockerImage aren't stored yet.
    const noConfigs = await store.getConfigs(repo);
    assert.strictEqual(noConfigs, undefined);
    const noRepos = await store.findReposWithPostProcessor(dockerImage);
    assert.deepStrictEqual(noRepos, []);

    // Insert some configs.
    const configs: Configs = {
      yaml: {
        docker: {
          image: dockerImage
        },
        "copy-dirs": []
      },
      lock: {
        docker: {
          image: dockerImage,
          digest: '123'
        }
      },
      commithash: 'abc',
      installationId: 42
    };
    await store.storeConfigs(repo, configs, null);
    try {
      
    } finally {
      await store.clearConfigs(repo);
    }
  });
});
