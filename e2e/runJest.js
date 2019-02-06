/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */
'use strict';

import path from 'path';
import fs from 'fs';
import execa, {sync as spawnSync} from 'execa';
import {Writable} from 'readable-stream';
import stripAnsi from 'strip-ansi';
import {normalizeIcons} from './Utils';

const JEST_PATH = path.resolve(__dirname, '../packages/jest-cli/bin/jest.js');

type RunJestOptions = {
  nodePath?: string,
  skipPkgJsonCheck?: boolean, // don't complain if can't find package.json
  stripAnsi?: boolean, // remove colors from stdout and stderr
};

// return the result of the spawned process:
//  [ 'status', 'signal', 'output', 'pid', 'stdout', 'stderr',
//    'envPairs', 'options', 'args', 'file' ]
export default function runJest(
  dir: string,
  args?: Array<string>,
  options: RunJestOptions = {},
) {
  const isRelative = !path.isAbsolute(dir);

  if (isRelative) {
    dir = path.resolve(__dirname, dir);
  }

  const localPackageJson = path.resolve(dir, 'package.json');
  if (!options.skipPkgJsonCheck && !fs.existsSync(localPackageJson)) {
    throw new Error(
      `
      Make sure you have a local package.json file at
        "${localPackageJson}".
      Otherwise Jest will try to traverse the directory tree and find the
      global package.json, which will send Jest into infinite loop.
    `,
    );
  }

  const env = {...process.env, FORCE_COLOR: 0};
  if (options.nodePath) env['NODE_PATH'] = options.nodePath;
  const result = spawnSync(JEST_PATH, args || [], {
    cwd: dir,
    env,
    reject: false,
  });

  // For compat with cross-spawn
  result.status = result.code;

  result.stdout = normalizeIcons(result.stdout);
  if (options.stripAnsi) result.stdout = stripAnsi(result.stdout);
  result.stderr = normalizeIcons(result.stderr);
  if (options.stripAnsi) result.stderr = stripAnsi(result.stderr);

  return result;
}

// Runs `jest` with `--json` option and adds `json` property to the result obj.
//   'success', 'startTime', 'numTotalTests', 'numTotalTestSuites',
//   'numRuntimeErrorTestSuites', 'numPassedTests', 'numFailedTests',
//   'numPendingTests', 'testResults'
export const json = function(
  dir: string,
  args?: Array<string>,
  options: RunJestOptions = {},
) {
  args = [...(args || []), '--json'];
  const result = runJest(dir, args, options);
  try {
    result.json = JSON.parse((result.stdout || '').toString());
  } catch (e) {
    throw new Error(
      `
      Can't parse JSON.
      ERROR: ${e.name} ${e.message}
      STDOUT: ${result.stdout}
      STDERR: ${result.stderr}
    `,
    );
  }
  return result;
};

// Runs `jest` until a given output is achieved, then kills it with `SIGTERM`
export const until = async function(
  dir: string,
  args?: Array<string>,
  text: string,
  options: RunJestOptions = {},
) {
  const isRelative = !path.isAbsolute(dir);

  if (isRelative) {
    dir = path.resolve(__dirname, dir);
  }

  const localPackageJson = path.resolve(dir, 'package.json');
  if (!options.skipPkgJsonCheck && !fs.existsSync(localPackageJson)) {
    throw new Error(
      `
      Make sure you have a local package.json file at
        "${localPackageJson}".
      Otherwise Jest will try to traverse the directory tree and find the
      the global package.json, which will send Jest into infinite loop.
    `,
    );
  }

  const env = {...process.env, FORCE_COLOR: 0};
  if (options.nodePath) env['NODE_PATH'] = options.nodePath;

    const proc = execa(JEST_PATH, args || [], {
        cwd: dir,
        env,
        reject: true,
        // this should never take more than 5-6 seconds, bailout after 30
        timeout: 35000
    });

    return new Promise((resolve, reject) => {
        proc.addListener('error', () => {
            console.log(`!! 2 - ${text}`);
            reject("boo");
        });

        proc.addListener('exit', () => {
            console.log(`!! 1 - ${text}`);
            let result = proc;
            result.status = result.code;

            result.stdout = normalizeIcons(result.stdout);
            if (options.stripAnsi) result.stdout = stripAnsi(result.stdout);
            result.stderr = normalizeIcons(result.stderr);
            if (options.stripAnsi) result.stderr = stripAnsi(result.stderr);

            resolve(result);
        });

        proc.stderr.pipe(
            new Writable({
              write(chunk, encoding, callback) {
                const output = chunk.toString('utf8');
        
                if (output.includes(text)) {
                    console.log(`!! 2 - Found: ${text}; kill`);
                    jestPromise.kill();
                    console.log(`!! 3 - ${text}`);
                    callback();
                    console.log(`!! 4 - ${text}`);
                } else {
                    callback();
                }
              },
            }),
        );
    });

//  console.log(JSON.stringify(jestPromise.pid, null, 2));
//  console.log(JSON.stringify(jestPromise.spawnargs, null, 2));
    console.log(`!! 0 ${text}`);
};
