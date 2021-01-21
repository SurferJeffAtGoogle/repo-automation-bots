#!/bin/bash
# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script uses the github app secret to authenticate with git SSL and the 'gh'
# comand line tool.

GITHUB_APP_INSTALLATION_ID=14207619
JWT=$(jwt encode --secret "$GITHUB_APP_SECRET" --iss "$GITHUB_APP_ID" --exp "+10 min" --alg RS256)

GITHUB_TOKEN=$(curl -X POST \
    -H "Authorization: Bearer $JWT" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens \
    | jq -r .token)