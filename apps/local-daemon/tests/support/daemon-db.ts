import type { Db, DbClient } from "@otomat/db";

import { setupTestDb } from "./db.js";

export interface DaemonTestDb {
  client: DbClient;
  db: Db;
  dbPath: string;
  /** Root the supervisor writes `runs/<id>/events.jsonl` under (mirrors `dirname(dbPath)`). */
  dataDir: string;
  cleanup(): void;
}

export function setupDaemonDb(): DaemonTestDb {
  const base = setupTestDb("otomat-daemon-");
  return {
    client: base.client,
    db: base.db,
    dbPath: base.dbPath,
    dataDir: base.dir,
    cleanup: base.cleanup,
  };
}
