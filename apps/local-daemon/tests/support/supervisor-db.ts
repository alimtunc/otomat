import type { Db, DbClient } from "@otomat/db";

import { setupTestDb } from "./db.js";

export interface SupervisorTestDb {
  client: DbClient;
  db: Db;
  /** Root the supervisor writes `runs/<id>/events.jsonl` under (mirrors `dirname(dbPath)`). */
  dataDir: string;
  cleanup(): void;
}

export function setupSupervisorDb(): SupervisorTestDb {
  const base = setupTestDb("otomat-sup-");
  return { client: base.client, db: base.db, dataDir: base.dir, cleanup: base.cleanup };
}
