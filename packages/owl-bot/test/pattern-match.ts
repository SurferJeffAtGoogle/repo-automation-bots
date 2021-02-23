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
import {newMinimatchFromSource} from '../src/pattern-match';
import * as assert from 'assert';

describe('confirm my understanding of minmatch', () => {
  it('matches patterns', () => {
    // All these patterns should be equivelent.
    const patterns = ['/a/*/b', '/a/*/b/', '/a/*/b/*', '/a/*/b/**'];
    for (const pattern of patterns) {
      const mm = newMinimatchFromSource(pattern);
      assert.ok(mm.match('/a/x/b/y'));
      assert.ok(mm.match('/a/x/b/y/z/q'));
      assert.ok(!mm.match('/a/b/c'));
    }
  });
});
