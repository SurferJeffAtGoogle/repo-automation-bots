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

import {Octokit} from '@octokit/rest';
// Conflicting linters think the next line is extraneous or necessary.
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {promisify} from 'util';
import {readFile} from 'fs';
import {getGitHubShortLivedAccessToken, core, Token} from './core';

const readFileAsync = promisify(readFile);

export type OctokitType =
  | InstanceType<typeof Octokit>
  | InstanceType<typeof ProbotOctokit>;

export interface OctokitParams {
  'pem-path': string;
  'app-id': number;
  installation: number;
}

/**
 * Creates an authenticated instance of octokit.
 */
export async function octokitFrom(params: OctokitParams): Promise<OctokitType> {
  const token = await githubTokenFrom(params);
  return await core.getAuthenticatedOctokit(token.token);
}

/**
 * Fetchs a short lived token from the github API.
 */
export async function githubTokenFrom(params: OctokitParams): Promise<Token> {
  const privateKey = await readFileAsync(params['pem-path'], 'utf8');
  const token = await getGitHubShortLivedAccessToken(
    privateKey,
    params['app-id'],
    params.installation
  );
  return token;
}


export interface OctokitFactory {
  getGitHubShortLivedAccessToken(): Promise<Token>;
  getShortLivedOctokit(token?: Token) : Promise<OctokitType>;
}

export function octokitFactoryFrom(params: OctokitParams): OctokitFactory {
  return {
    getGitHubShortLivedAccessToken() { return githubTokenFrom(params); },
    async getShortLivedOctokit(token?: Token) {
      const atoken = token ?? await githubTokenFrom(params);
      return await core.getAuthenticatedOctokit(atoken.token);
    }
  };
}
