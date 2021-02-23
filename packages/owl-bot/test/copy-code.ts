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

import { describe, it } from 'mocha';
import * as assert from 'assert';
import { stripPrefix, copyDirs } from '../src/copy-code';
import path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import tmp from 'tmp';
import { OwlBotYaml } from '../src/config-files';

describe('stripPrefix', () => {
  const norm = path.normalize;
  it('works normally', () => {
    assert.strictEqual(stripPrefix('/a/*/c', '/a/b/c/d/e'), norm('d/e'));
    assert.strictEqual(stripPrefix('/a/*/c', '/a/b/c/d'), norm('d'));
    assert.strictEqual(stripPrefix('/a/*/*', '/a/b/c/d/e'), norm('d/e'));
    assert.strictEqual(stripPrefix('/*/*/*', '/a/b/c/d/e'), norm('d/e'));
  });
  it('works with trailing slash', () => {
    assert.strictEqual(stripPrefix(norm('/a/*/c/'), norm('/a/b/c/d/e')), norm('d/e'));
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

describe('copyDirs', () => {
  /**
   * Creates a sample source tree.
   */
  function makeSourceTree(rootDir: string): string {
    const dirs = [
      'source',
      'source/a',
      'source/b',
      'source/a/x',
      'source/b/y',
      'source/b/z',
    ];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(rootDir, dir));
    }
    const files = [
      'source/q.txt:q',
      'source/a/r.txt:r',
      'source/b/y/s.txt:s',
    ];
    for (const file of files) {
      const [name, content] = file.split(':');
      fs.writeFileSync(path.join(rootDir, name), content);
    }
    return path.join(rootDir, dirs[0]);
  }

  /**
   * Collects the entire source tree content into a list that can
   * be easily compared equal in a test.
   */
  function collectDirTree(dir: string): string[] {
    const tree: string[] = [];
    for (const apath of glob.sync('**', { cwd: dir })) {
      const fullPath = path.join(dir, apath);
      if (fs.lstatSync(fullPath).isDirectory()) {
        tree.push(apath);
      } else {
        const content = fs.readFileSync(fullPath, { encoding: 'utf8' });
        tree.push(`${apath}:${content}`);
      }
    }
    tree.sort();
    return tree;
  }

  it('works', () => {
    const tempo = tmp.dirSync();
    const sourceDir = makeSourceTree(tempo.name);
    const destDir = path.join(tempo.name, 'dest');
    const yaml: OwlBotYaml = {
      "copy-dirs":
        [{
          source: "/b/y",
          dest: "/y",
          "strip-prefix": "/b"
        }]
    };
    copyDirs(sourceDir, destDir, yaml);
    assert.deepStrictEqual(collectDirTree(destDir), []);
  });
});
