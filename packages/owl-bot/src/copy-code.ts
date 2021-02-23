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
import {core} from './core';
import tmp from 'tmp';

const readFileAsync = promisify(readFile);

export interface Args extends OctokitParams {
  'source-repo': string;
  'source-repo-commit-hash': string;
  'dest-repo': string;
}

// Creates a function that first prints, then executes a shell command.
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
  let octokit = await octokitFrom(args);
  if (
    await copyExists(
      octokit,
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Copy already exists.  Don't copy again.
  }
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);

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
  const sourceLink = `https://github.com/googleapis/googleapis/commit/${args['source-repo-commit-hash']}`;
  let yaml: OwlBotYaml;
  const [owner, repo] = args['dest-repo'].split('/');
  try {
    const text = await readFileAsync(yamlPath, 'utf8');
    const obj = load(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yaml = owlBotYamlFrom(obj as Record<string, any>);
  } catch (e) {
    logger.error(e);
    octokit.issues.create({
      owner,
      repo,
      title: `${owlBotYamlPath} is missing or defective`,
      body: `While attempting to copy files from\n${sourceLink}\n\n${e}`,
    });
    return; // Success because we don't want to retry.
  }

  copyDirs(sourceDir, destDir, yaml, logger);

  // Commit changes to branch.
  const commitMsgPath = path.resolve(path.join(workDir, 'commit-msg.txt'));
  let commitMsg = cmd('git log -1 --format=%s%n%n%b', {
    cwd: sourceDir,
  }).toString('utf8');
  commitMsg += `Source-Link: ${sourceLink}\n`;
  fs.writeFileSync(commitMsgPath, commitMsg);
  cmd('git add -A', {cwd: destDir});
  cmd(`git commit -F "${commitMsgPath}" --allow-empty`, {cwd: destDir});

  // Check for existing pull request one more time before we push.
  const privateKey = await readFileAsync(args['pem-path'], 'utf8');
  const token = await core.getGitHubShortLivedAccessToken(
    privateKey,
    args['app-id'],
    args.installation
  );
  // Octokit token may have expired; refresh it.
  octokit = await core.getAuthenticatedOctokit(token.token);
  if (
    await copyExists(
      octokit,
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Mid-air collision!
  }

  const githubRepo = await octokit.repos.get({owner, repo});

  // Push to origin.
  cmd(
    `git remote set-url origin https://x-access-token:${token.token}@github.com/googleapis/googleapis-gen.git`
  );
  cmd(`git push origin ${destBranch}`);

  // Create a pull request.
  await octokit.pulls.create({
    owner,
    repo,
    head: destBranch,
    base: githubRepo.data.default_branch,
  });
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
  let deadPaths: string[] = [];
  for (const copyDir of yaml['copy-dirs'] ?? []) {
    if (trimSlashes(copyDir.dest) === '') {
      // Java copies everything into the root of the repo, and we don't want
      // to wipe out the root.
      const killPattern = path.join(destDir, path.basename(copyDir.source));
      deadPaths = glob.sync(killPattern);
    } else {
      deadPaths = [path.join(destDir, copyDir.dest)];
    }
  }
  for (const deadPath of deadPaths) {
    if (stat(deadPath)) {
      logger.info(`rm -r ${deadPath}`);
      fs.rmSync(deadPath, {recursive: true});
    }
  }

  // Copy the files from source to dest.
  for (const copyDir of yaml['copy-dirs'] ?? []) {
    let pattern = makePatternMatchAllSubdirs(copyDir.source);
    pattern = trimSlashes(pattern);
    const sourcePaths = glob.sync(pattern, {cwd: sourceDir});
    for (const sourcePath of sourcePaths) {
      const fullSourcePath = path.join(sourceDir, sourcePath);
      const relPath = stripPrefix(copyDir['strip-prefix'], sourcePath);
      const fullDestPath = path.join(destDir, copyDir.dest, relPath);
      if (stat(fullSourcePath)?.isDirectory()) {
        logger.info('mkdir ' + fullDestPath);
        fs.mkdirSync(fullDestPath, {recursive: true});
        continue;
      }
      const dirName = path.dirname(fullDestPath);
      if (!stat(dirName)?.isDirectory()) {
        logger.info('mkdir ' + dirName);
        fs.mkdirSync(dirName, {recursive: true});
      }
      logger.info(`cp ${fullSourcePath} ${fullDestPath}`);
      fs.copyFileSync(fullSourcePath, fullDestPath);
    }
  }
}

/**
 * Converts slashes to the local platform slashes, then removes a leading
 * and trailing slash if they're present.
 */
function trimSlashes(apath: string) {
  apath = path.normalize(apath);
  const start = apath.startsWith(path.sep) ? 1 : 0;
  const end = apath.endsWith(path.sep) ? apath.length - 1 : apath.length;
  return apath.slice(start, end > start ? end : start);
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
  const pattern = trimSlashes(prefix ?? '');
  filePath = trimSlashes(filePath);
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
