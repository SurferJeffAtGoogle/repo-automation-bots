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

import {IMinimatch, Minimatch} from 'minimatch';

// Exported for testing purposes.
export function newMinimatchFromSource(pattern: string): IMinimatch {
  return new Minimatch(makePatternMatchAllSubdirs(pattern), {matchBase: true});
}

export function makePatternMatchAllSubdirs(pattern: string): string {
  // Make sure pattern always ends with /**
  if (pattern.endsWith('/**')) {
    // Good, nothing to do.
  } else if (pattern.endsWith('/*')) {
    pattern += '*';
  } else if (pattern.endsWith('/')) {
    pattern += '**';
  } else {
    pattern += '/**';
  }
  return pattern;
}
