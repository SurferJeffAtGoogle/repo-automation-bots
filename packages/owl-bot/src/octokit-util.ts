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
import {sign} from 'jsonwebtoken';
import {request} from 'gaxios';

const readFileAsync = promisify(readFile);

export type OctokitType =
  | InstanceType<typeof Octokit>
  | InstanceType<typeof ProbotOctokit>;

/**
 * Common command line parameters needed for creating an instance of Octokit.
 */
export interface OctokitParams {
  'pem-path': string;
  'app-id': number;
  installation: number;
}

/**
 * Like OctokitParams, but privateKey contains the text that was stored in pem-path.
 */
export interface AuthArgs {
  privateKey: string;
  appId: number;
  installation: number;
}

/**
 * Convert OctokitParams to AuthArgs.
 */
export async function authArgsFrom(params: OctokitParams): Promise<AuthArgs> {
  return {
    privateKey: await readFileAsync(params['pem-path'], 'utf8'),
    appId: params["app-id"],
    installation: params.installation
  };
}

/**
 * Creates an authenticated instance of octokit.
 */
export async function octokitFrom(params: OctokitParams | AuthArgs): Promise<OctokitType> {
  const token = await githubTokenFrom(params);
  return new Octokit({auth: token.token });
}

/**
 * Fetchs a short lived token from the github API.
 */
export async function githubTokenFrom(params: OctokitParams | AuthArgs): Promise<Token> {
  const args: AuthArgs = 'privateKey' in params ? params : await authArgsFrom(params);
  const token = await getGitHubShortLivedAccessToken(
    args.privateKey,
    args.appId,
    args.installation
  );
  return token;
}

/**
 * Interface lets us easily replace in tests.
 */
export interface OctokitFactory {
  getGitHubShortLivedAccessToken(): Promise<Token>;
  getShortLivedOctokit(token?: Token) : Promise<OctokitType>;
}

/**
 * Creates an octokit factory from the common params.
 */
export function octokitFactoryFrom(params: OctokitParams | AuthArgs): OctokitFactory {
  return {
    getGitHubShortLivedAccessToken() { return githubTokenFrom(params); },
    async getShortLivedOctokit(token?: Token) {
      const atoken = token ?? await githubTokenFrom(params);
      return new Octokit({auth: atoken.token });
    }
  };
}

/**
 * A github token with a 9-minute lifetime.
 */
export interface Token {
  token: string;
  expires_at: string;
  permissions: object;
  repository_selection: string;
}

async function getGitHubShortLivedAccessToken(
  privateKey: string,
  appId: number,
  installation: number
): Promise<Token> {
  const payload = {
    // issued at time
    // Note: upstream API seems to fail if decimals are included
    // in unixtime, this is why parseInt is run:
    iat: parseInt('' + Date.now() / 1000),
    // JWT expiration time (10 minute maximum)
    exp: parseInt('' + Date.now() / 1000 + 10 * 60),
    // GitHub App's identifier
    iss: appId,
  };
  const jwt = sign(payload, privateKey, {algorithm: 'RS256'});
  const resp = await request<Token>({
    url: getAccessTokenURL(installation),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (resp.status !== 201) {
    throw Error(`unexpected response http = ${resp.status}`);
  } else {
    return resp.data;
  }
}

function getAccessTokenURL(installation: number) {
  return `https://api.github.com/app/installations/${installation}/access_tokens`;
}