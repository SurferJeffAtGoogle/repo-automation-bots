// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  validateYaml,
  validateSchema,
  checkCodeOwners,
} from '../src/check-config.js';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';
import yaml from 'js-yaml';
import nock from 'nock';
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});
const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

nock.disableNetConnect();

function getCodeOwnersFile(response: string | undefined, status: number) {
  return nock('https://api.github.com')
    .get('/repos/owner/repo/contents/.github%2FCODEOWNERS')
    .reply(
      status,
      response ? {content: Buffer.from(response).toString('base64')} : undefined
    );
}

async function invalidateSchema(configNum: number) {
  return await validateSchema(
    yaml.load(
      fs.readFileSync(
        `./test/fixtures/config/invalid-schemas/invalid-schema${configNum}.yml`,
        'utf8'
      )
    )
  );
}

describe('check for config', () => {
  describe('whether config is a valid YAML object', () => {
    it('should return error message if YAML is invalid', () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/invalid-schemas/invalid-yaml-config.yml',
          'utf8'
        )
      );
      assert.strictEqual(
        isYamlValid.message,
        'File is not properly configured YAML'
      );
    });

    it('should return true if YAML is valid', async () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema1.yml',
          'utf8'
        )
      );
      assert.strictEqual(isYamlValid.isValid, true);
    });
  });

  describe('whether YAML file has valid schema', async () => {
    it('should fail if YAML has any other properties than the ones specified', async () => {
      //does not have any additional properties
      assert.deepStrictEqual((await invalidateSchema(1)).errorMessages, [
        {
          wrongProperty: {additionalProperty: 'notTheRules'},
          message: 'should NOT have additional properties',
        },
      ]);
    });

    it('should fail if title does not match first author', async () => {
      //title does not correspond to author
      assert.deepStrictEqual((await invalidateSchema(2)).errorMessages, [
        {
          wrongProperty: {allowedValue: '^chore: regenerate README$'},
          message: 'should be equal to constant',
        },
      ]);
    });

    it('should fail if title does not match second author', async () => {
      //title does not correspond to author
      assert.deepStrictEqual((await invalidateSchema(3)).errorMessages, [
        {
          wrongProperty: {allowedValue: '^chore: release'},
          message: 'should be equal to constant',
        },
      ]);
    });

    it('should fail if title does not match third author', async () => {
      //title does not correspond to author
      assert.deepStrictEqual((await invalidateSchema(4)).errorMessages, [
        {
          wrongProperty: {
            allowedValue: '^chore: autogenerated discovery document update',
          },
          message: 'should be equal to constant',
        },
      ]);
    });

    it('should fail if author is not allowed', async () => {
      //author is not allowed
      assert.deepStrictEqual((await invalidateSchema(5)).errorMessages, [
        {
          message: 'should be equal to one of the allowed values',
          wrongProperty: {
            allowedValues: [
              'googleapis-publisher',
              'yoshi-automation',
              'yoshi-code-bot',
            ],
          },
        },
      ]);
    });

    it('should fail if it does not have title property', async () => {
      //missing 'title' property
      assert.deepStrictEqual((await invalidateSchema(6)).errorMessages, [
        {
          wrongProperty: {missingProperty: 'title'},
          message: "should have required property 'title'",
        },
      ]);
    });

    it('should fail if config is empty', async () => {
      //empty array
      assert.deepStrictEqual((await invalidateSchema(7)).errorMessages, [
        {wrongProperty: {type: 'object'}, message: 'should be object'},
      ]);
    });

    it('should fail if there are duplicate items', async () => {
      //duplicate items
      assert.deepStrictEqual((await invalidateSchema(8)).errorMessages, [
        {
          wrongProperty: {i: 1, j: 0},
          message:
            'should NOT have duplicate items (items ## 0 and 1 are identical)',
        },
      ]);
    });

    it('should return true if YAML has all of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        yaml.load(
          fs.readFileSync(
            './test/fixtures/config/valid-schemas/valid-schema1.yml',
            'utf8'
          )
        )
      );
      assert.ok(isSchemaValid.isValid);
    });

    it('should return true if YAML has any one of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        yaml.load(
          fs.readFileSync(
            './test/fixtures/config/valid-schemas/valid-schema2.yml',
            'utf8'
          )
        )
      );
      assert.ok(isSchemaValid.isValid);
    });

    it('should return true if YAML has some of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        yaml.load(
          fs.readFileSync(
            './test/fixtures/config/valid-schemas/valid-schema3.yml',
            'utf8'
          )
        )
      );
      assert.ok(isSchemaValid.isValid);
    });
  });

  describe('codeowner file behavior', async () => {
    it('should ask to change CODEOWNERS, if CODEOWNERS file is not configured properly (and the CODEOWNERS is not in the PR)', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-codeowners/invalid-codeowners1',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response.message,
        `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });

    it('should ask to change codeowners, if codeowners file does not contain proper owners for config path (and the CODEOWNERS is not in the PR)', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-codeowners/invalid-codeowners2',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response.message,
        `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });

    it('should accept a well-configured CODEOWNERS file', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-codeowners',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.ok(response.isValid);
    });

    it('should accept a well-configured CODEOWNERS file in PR', async () => {
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        fs.readFileSync('./test/fixtures/config/valid-codeowners', 'utf8')
      );
      assert.ok(response.isValid);
    });

    it('should ask to create a codeowners file if it does not exist', async () => {
      const scopes = getCodeOwnersFile(undefined, 403);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response.message,
        `You must create a CODEOWNERS file for the configuration file for auto-approve.yml that lives in .github/CODEWONERS in your repository, and contains this line: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/; please make sure it is accessible publicly.`
      );
    });

    it('should ask to change CODEOWNERS file in PR if it is not correctly formatted', async () => {
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        fs.readFileSync(
          './test/fixtures/config/invalid-codeowners/invalid-codeowners1',
          'utf8'
        )
      );
      assert.deepStrictEqual(
        response.message,
        `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });
  });
});
