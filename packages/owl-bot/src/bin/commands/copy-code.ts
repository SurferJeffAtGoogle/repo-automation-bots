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

// To Run: node ./build/src/bin/owl-bot.js validate ~/.OwlBot.yaml

import {promisify} from 'util';
import {readFile} from 'fs';
import {Args, copyCode} from '../../copy-code';
import yargs = require('yargs');
import {getGitHubShortLivedAccessToken} from '../../core';

const readFileAsync = promisify(readFile);

export const copyCodeCommand: yargs.CommandModule<{}, Args> = {
  command: 'open-pr',
  describe: 'Open a pull request with an updated .OwlBot.lock.yaml',
  builder(yargs) {
    return yargs
      .option('pem-path', {
        describe: 'provide path to private key for requesting JWT',
        type: 'string',
        demand: true,
      })
      .option('app-id', {
        describe: 'GitHub AppID',
        type: 'number',
        demand: true,
      })
      .option('installation', {
        describe: 'installation ID for GitHub app',
        type: 'number',
        demand: true,
      })
      .option('source-repo', {
        describe:
          'The github repository from which files are copied.  Always googleapis/googleapis-gen.',
        type: 'string',
        demand: true,
      })
      .option('source-repo-commit-hash', {
        describe:
          'The commit hash of the source repo from which to copy files.',
        type: 'string',
        demand: true,
      })
      .option('dest-repo', {
        describe:
          'The github repository to copy files to.  Example: googleapis/nodejs-vision.',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    await copyCode(argv);
  },
};
