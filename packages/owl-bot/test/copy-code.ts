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
import {stripPrefix} from '../src/copy-code';
import path from 'path';

describe('stripPrefix', () => {
  const norm = path.normalize;
  it('works normally', () => {
    assert.strictEqual(stripPrefix('/a/*/c', '/a/b/c/d/e'), norm('d/e'));
    assert.strictEqual(stripPrefix('/a/*/c', '/a/b/c/d'), norm('d'));
    assert.strictEqual(stripPrefix('/a/*/*', '/a/b/c/d/e'), norm('d/e'));
    assert.strictEqual(stripPrefix('/*/*/*', '/a/b/c/d/e'), norm('d/e'));
  });
  it('works with empty prefix', () => {
    assert.strictEqual(stripPrefix(undefined, '/a/b/c/d/e'), norm('a/b/c/d/e'));
    assert.strictEqual(stripPrefix('', '/a/b/c/d/e'), norm('a/b/c/d/e'));
    assert.strictEqual(stripPrefix('/', '/a/b/c/d/e'), norm('a/b/c/d/e'));
  });
  it('returns whole argument for mismatched prefix', () => {
    assert.strictEqual(stripPrefix('/b/c', '/a/b/c/d/e'), norm('a/b/c/d/e'));
  });
  it('returns final path segment for complete match', () => {
    assert.strictEqual(stripPrefix('/a/*/c', '/a/b/c'), norm('c'));
  });
});
