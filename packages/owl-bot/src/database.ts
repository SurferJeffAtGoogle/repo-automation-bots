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

import admin from "firebase-admin";
import { OwlBotLock, OwlBotYaml } from "./config-files";

export interface Configs {
  // The body of .Owlbot.lock.yaml.
  lock: OwlBotLock | undefined,
  // The body of .Owlbot.yaml.
  yaml: OwlBotYaml | undefined,
  // The commit hash from which the config files were retrieved.
  commithash: string
};

export type Db = admin.firestore.Firestore;

const YAMLS = 'owl-bot-yamls';

export async function getConfigs(db: Db, repo: string): Promise<Configs | undefined> {
  const docRef = db.collection(YAMLS).doc(repo);
  const doc = await docRef.get();
  // Should we verify the data?
  return doc.data() as Configs;
}


// Returns true if the store succeeded.
// Returns false if replaceCommithash differed from the commithash in the
// db, and therefore nothing was stored.
export async function storeConfigs(db: Db, repo: string, configs: Configs,
  replaceCommithash: string | null): Promise<boolean> {
  const docRef = db.collection(YAMLS).doc(repo);
  let updatedDoc = false;
  await db.runTransaction(async (t) => {
    const doc = await t.get(docRef);
    const prevConfigs = doc.data() as Configs | undefined;
    if ((prevConfigs && prevConfigs.commithash == replaceCommithash) ||
      (!prevConfigs && replaceCommithash === null)) {
      t.update(docRef, configs);
      updatedDoc = true;
    }
  });
  return updatedDoc;
}

export async function findReposWithPostProcessor(db: Db, dockerImageName: string): Promise<[string, Configs][]> {
  const ref = db.collection(YAMLS);
  const got = await ref.where('yaml.docker.image', '==', dockerImageName).get();
  return got.docs.map(doc => [doc.id, doc.data() as Configs]);
}  
