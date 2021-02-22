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

import { OctokitType } from "./core";

export interface Args {
    'pem-path': string;
    'app-id': number;
    installation: number;
    'source-repo': string;
    'source-repo-commit-hash': string;
    'dest-repo': string;
}

export async function copyExists(octokit: OctokitType, destRepo: string, sourceCommitHash: string, logger = console): Promise<boolean> {
    const q = `repo:${destRepo}+${sourceCommitHash}`;
    const foundCommits = await octokit.search.commits({q});
    if (foundCommits.data.total_count > 0) {
        logger.info(`Commit with ${sourceCommitHash} already exists in ${destRepo}.`);
        return true;
    } else {
        const found = await octokit.search.issuesAndPullRequests({q});
        if (found.data.total_count > 0) {
            logger.info(`Issue or pull request with ${sourceCommitHash} already exists in ${destRepo}.`);
            return true;
        } else {
            logger.info(`${sourceCommitHash} not found in ${destRepo}.`);
            return false;
        }
    }
}
