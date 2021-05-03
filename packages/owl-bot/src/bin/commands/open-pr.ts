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

// Run like this:
// node ./build/src/bin/owl-bot.js list-repos --docker-image foo

import {ConfigsStore} from '../../configs-store';
import yargs = require('yargs');
import { triggerOneBuildForUpdatingLock } from '../../handlers';

interface Args {
  'docker-image': string;
  'docker-digest': string;
  repo: string;
  project: string | undefined;
}

export const openPR: yargs.CommandModule<{}, Args> = {
  command: 'open-pr',
  describe: 'Triggers a cloud build with the new .OwlBot.lock.yaml.  Opens a new pull request if the generated code changed.',
  builder(yargs) {
    return yargs
      .option('docker-image', {
        describe:
          'The full path of the docker image that changed.  ex: gcr.io/repo-automation-bots/nodejs-post-processor',
        type: 'string',
        demand: true,
      })
      .option('docker-digest', {
        describe: 'the docker digest sha',
        type: 'string',
        demand: true,
      })
      .option('repo', {
        describe: 'repository to run against, e.g., googleapis/foo',
        type: 'string',
        demand: true,
      })
      .option('project', {
        describe: 'google cloud project id in which to create the cloud build',
        type: 'string',
        demand: false,
      });
  },
  async handler(argv) {
    const fakeConfigStore = ({
      findPullRequestForUpdatingLock: () => undefined,
      recordPullRequestForUpdatingLock: () => {},
    } as unknown) as ConfigsStore;
    const project = argv.project || process.env.PROJECT_ID;
    if (!project) {
      throw Error('gcloud project id must be provided via project arg or environment variable PROJECT_ID');
    }    
    await triggerOneBuildForUpdatingLock(
      fakeConfigStore,
      argv.repo,
      {
        docker: {
          image: argv['docker-image'],
          digest: argv['docker-digest'],
        },
      },
      project
    );
  },
};
