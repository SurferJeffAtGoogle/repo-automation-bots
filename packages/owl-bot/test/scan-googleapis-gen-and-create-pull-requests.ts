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
import { describe, it } from 'mocha';
import { scanGoogleapisGenAndCreatePullRequests } from '../src/scan-googleapis-gen-and-create-pull-requests';
import { newCmd } from '../src/copy-code';
import { makeDirTree } from './dir-tree';
import { OctokitFactory, OctokitType } from '../src/octokit-util';
import { OwlBotYaml, owlBotYamlPath } from '../src/config-files';
import { ConfigsStore } from '../src/configs-store';
import * as fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { GithubRepo } from '../src/github-repo';
import { FakeConfigsStore } from './fake-configs-store';

describe('scanGoogleapisGenAndCreatePullRequests', () => {
  function makeAbcRepo(): string {
    // Create a git repo.
    const dir = tmp.dirSync().name;
    const cmd = newCmd();
    cmd('git init', { cwd: dir });

    // Add 3 commits
    makeDirTree(dir, ['a.txt:1']);
    cmd('git add -A', { cwd: dir });
    cmd('git commit -m a', { cwd: dir });

    makeDirTree(dir, ['b.txt:2']);
    cmd('git add -A', { cwd: dir });
    cmd('git commit -m b', { cwd: dir });

    makeDirTree(dir, ['c.txt:3']);
    cmd('git add -A', { cwd: dir });
    cmd('git commit -m c', { cwd: dir });
    return dir;
  }

  const abcRepo = makeAbcRepo();

  function makeRepoWithOwlBotYaml(owlBotYaml: OwlBotYaml): string {
    const dir = tmp.dirSync().name;
    const cmd = newCmd();
    cmd('git init', { cwd: dir });

    const yamlPath = path.join(dir, owlBotYamlPath);
    fs.mkdirSync(path.dirname(yamlPath), { recursive: true });
    const text = yaml.dump(owlBotYaml);
    fs.writeFileSync(yamlPath, text);

    cmd('git add -A', { cwd: dir });
    cmd('git commit -m "Hello OwlBot"', { cwd: dir });

    return dir;
  }

  it('does nothing with zero repos affected', async () => {
    assert.strictEqual(
      await scanGoogleapisGenAndCreatePullRequests(
        abcRepo,
        {} as OctokitFactory,
        new FakeConfigsStore(),
      ),
      0
    );
  });

  function factory(octokit: any): OctokitFactory {
    return {
      getGitHubShortLivedAccessToken(): Promise<string> {
        return Promise.resolve('fake-token');
      },
      getShortLivedOctokit(token?: string): Promise<OctokitType> {
        return Promise.resolve(octokit as OctokitType);
      },
    };
  }

  const bYaml: OwlBotYaml = {
    'deep-copy-regex': [
      {
        source: '/b.txt',
        dest: '/src/b.txt',
        'rm-dest': '/src',
      },
    ],
  };

  it('does nothing when a pull request already exists', async () => {
    const octokit = {
      search: {
        commits() {
          return Promise.resolve({ data: { total_count: 1 } });
        },
      },
    };

    assert.strictEqual(
      await scanGoogleapisGenAndCreatePullRequests(
        abcRepo,
        factory(octokit),
        new FakeConfigsStore(),
      ),
      0
    );
  });

  class FakeIssues {
    issues: any[] = [];

    constructor(issues: any[] = []) {
      this.issues = issues;
    }

    listForRepo() {
      return Promise.resolve({ data: this.issues });
    }

    create(issue: any) {
      this.issues.push(issue);
      issue.html_url = `http://github.com/fake/issues/${this.issues.length}`;
      return Promise.resolve({ data: issue });
    }
  }

  class FakePulls {
    pulls: any[] = [];

    list() {
      return Promise.resolve({ data: this.pulls });
    }

    create(pull: any) {
      this.pulls.push(pull);
      return Promise.resolve({ data: { html_url: `http://github.com/fake/pulls/${this.pulls.length}` } });
    }
  }

  it('copies files', async () => {
    const pulls = new FakePulls();
    const octokit = {
      search: {
        commits() {
          return Promise.resolve({ data: { total_count: 0 } });
        },
        issuesAndPullRequests() {
          return Promise.resolve({ data: { items: [] } });
        },
      },
      pulls: pulls,
      issues: new FakeIssues(),
      repos: {
        get() {
          return {
            data: {
              default_branch: "main"
            }
          };
        }
      }
    };

    const destDir = makeRepoWithOwlBotYaml(bYaml);
    const destRepo: GithubRepo = {
      owner: 'googleapis',
      repo: 'nodejs-spell-check',
      getCloneUrl(): string { return destDir; }
    };

    const destRepoName = `${destRepo.owner}/${destRepo.repo}`;
    const configsStore = new FakeConfigsStore(new Map([
      [
        destRepoName,
        {
          branchName: 'main',
          commitHash: '456',
          installationId: 42,
          yaml: bYaml
        },
      ],
    ]));
    configsStore.githubRepos.set(destRepoName, destRepo);
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
    );
    assert.deepStrictEqual(pulls, {});
  });
});
