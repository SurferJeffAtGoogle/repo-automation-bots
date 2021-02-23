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

import {promisify} from 'util';
import {readFile} from 'fs';
import * as proc from 'child_process';
import {owlBotYamlPath, owlBotYamlFrom, OwlBotYaml} from './config-files';
import path from 'path';
import {load} from 'js-yaml';
import {v4 as uuidv4} from 'uuid';
import glob from 'glob';
import * as fs from 'fs';
import {makePatternMatchAllSubdirs} from './pattern-match';
import {Minimatch} from 'minimatch';
import {OctokitParams, octokitFrom, OctokitType} from './octokit-util';

const readFileAsync = promisify(readFile);

export interface Args extends OctokitParams {
  'source-repo': string;
  'source-repo-commit-hash': string;
  'dest-repo': string;
}

type Cmd = (
  command: string,
  options?: proc.ExecSyncOptions | undefined
) => Buffer;
function newCmd(logger = console): Cmd {
  const cmd = (
    command: string,
    options?: proc.ExecSyncOptions | undefined
  ): Buffer => {
    logger.info(command);
    return proc.execSync(command, options);
  };
  return cmd;
}

export async function copyCode(args: Args, logger = console): Promise<void> {
  if (
    await copyExists(
      await octokitFrom(args),
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Copy already exists.  Don't copy again.
  }
  const workDir = '.';
  const sourceDir = path.join(workDir, 'source');
  const destDir = path.join(workDir, 'dest');
  const destBranch = 'owl-bot-' + uuidv4();

  const cmd = newCmd(logger);

  // Clone the two repos.
  cmd(
    `git clone --single-branch "https://${args['source-repo']}.git" ${sourceDir}`
  );
  cmd(
    `git clone --single-branch "https://${args['dest-repo']}.git" ${destDir}`
  );

  // Check out the specific hash we want to copy from.
  cmd(`git checkout ${args['source-repo-commit-hash']}`, {cwd: sourceDir});

  // Check out a dest branch.
  cmd(`git checkout -b ${destBranch}`, {cwd: destDir});

  // Load the OwlBot.yaml file in dest.
  const yamlPath = path.join(destDir, owlBotYamlPath);
  let yaml: OwlBotYaml;
  try {
    const text = await readFileAsync(yamlPath, 'utf8');
    const obj = load(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yaml = owlBotYamlFrom(obj as Record<string, any>);
  } catch (e) {
    logger.error(e);
    // TODO: open an issue on the dest repository.
    return; // Success because we don't want to retry.
  }

  copyDirs(sourceDir, destDir, yaml, logger);

  // TODO: commit changes to branch.
  // TODO: push branch.
  if (
    await copyExists(
      await octokitFrom(args),
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Mid-air collision!
  }
  // TODO: create pull request.
}

// returns undefined instead of throwing an exception.
function stat(path: string): fs.Stats | undefined {
  try {
    return fs.statSync(path);
  } catch (e) {
    return undefined;
  }
}

/**
 * Copies directories and files specified by yaml.
 * @param sourceDir the path to the source repository directory
 * @param destDir the path to the dest repository directory.
 * @param yaml the OwlBot.yaml file from the dest repository.
 */
export function copyDirs(
  sourceDir: string,
  destDir: string,
  yaml: OwlBotYaml,
  logger = console
): void {
  // Wipe out the existing contents of the dest directory.
  for (const copyDir of yaml['copy-dirs'] ?? []) {
    const fullPath = path.join(destDir, copyDir.dest);
    if (stat(fullPath)) {
      logger.info(`rm -rf ${fullPath}`);
      fs.rmdirSync(fullPath, { recursive: true });
    }
  }

  // Copy the files from source to dest.
  for (const copyDir of yaml['copy-dirs'] ?? []) {
    let pattern = makePatternMatchAllSubdirs(copyDir.source);
    pattern = path.normalize(pattern);
    if (pattern.startsWith(path.sep)) {
      pattern = pattern.slice(1, pattern.length - 1);
    }
    const sourcePaths = glob.sync(pattern, {cwd: sourceDir});
    for (const sourcePath of sourcePaths) {
      const fullSourcePath = path.join(sourceDir, sourcePath);
      const relPath = stripPrefix(copyDir['strip-prefix'], sourcePath);
      const fullDestPath = path.join(destDir, relPath);
      const dirName = path.dirname(fullDestPath);
      if (!stat(dirName)?.isDirectory()) {
        logger.info('mkdir ' + dirName);
        fs.mkdirSync(dirName, { recursive: true });
      }
      logger.info(`cp ${fullSourcePath} ${fullDestPath}`);
      fs.copyFileSync(fullSourcePath, fullDestPath);
    }
  }
}

/**
 * Strips a prefix from a filepath.
 * @param prefix the prefix to strip; can contain wildcard characters like * and ?
 * @param filePath the path from which to strip the prefix.
 */
export function stripPrefix(
  prefix: string | undefined,
  filePath: string
): string {
  let pattern = prefix ?? "";
  if (pattern.endsWith(path.sep)) {
      pattern = pattern.slice(0, pattern.length - 1);
  }
  const mm = new Minimatch(pattern, {matchBase: true});
  if (mm.match(filePath)) {
    return path.basename(filePath);
  }
  const pathSegments: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dirName = path.dirname(filePath);
    const fileName = path.basename(filePath);
    pathSegments.push(fileName);
    if (
      mm.match(dirName) ||
      dirName === '' ||
      dirName === path.sep ||
      dirName === filePath
    ) {
      break;
    }
    filePath = dirName;
  }
  pathSegments.reverse();
  return path.join(...pathSegments);
}

/**
 * Searches for instances of the sourceCommitHash in recent pull requests and commits.
 *
 * @param octokit an octokit instance
 * @param destRepo the repo to search
 * @param sourceCommitHash the string to search for
 */
export async function copyExists(
  octokit: OctokitType,
  destRepo: string,
  sourceCommitHash: string,
  logger = console
): Promise<boolean> {
  const q = `repo:${destRepo}+${sourceCommitHash}`;
  const foundCommits = await octokit.search.commits({q});
  if (foundCommits.data.total_count > 0) {
    logger.info(`Commit with ${sourceCommitHash} exists in ${destRepo}.`);
    return true;
  }
  const found = await octokit.search.issuesAndPullRequests({q});
  for (const item of found.data.items) {
    logger.info(
      `Issue or pull request ${item.number} with ${sourceCommitHash} exists in ${destRepo}.`
    );
    return true;
  }
  // I observed octokit.search.issuesAndPullRequests() not finding recent, open
  // pull requests.  So enumerate them.
  const [owner, repo] = destRepo.split('/');
  const pulls = await octokit.pulls.list({owner, repo, per_page: 100});
  for (const pull of pulls.data) {
    const pos: number = pull.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Pull request ${pull.number} with ${sourceCommitHash} exists in ${destRepo}.`
      );
      return true;
    }
  }
  // And enumerate recent issues too.
  const issues = await octokit.issues.list({owner, repo, per_page: 100});
  for (const issue of issues.data) {
    const pos: number = issue.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Issue ${issue.number} with ${sourceCommitHash} exists in ${destRepo}.`
      );
      return true;
    }
  }

  logger.info(`${sourceCommitHash} not found in ${destRepo}.`);
  return false;
}
