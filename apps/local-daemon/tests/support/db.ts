import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, runMigrations, schema, type Db, type DbClient } from "@otomat/db";

export interface TestDb {
  client: DbClient;
  db: Db;
  dir: string;
  cleanup(): void;
}

/** Fresh migrated SQLite in a temp dir, seeded with the p1/i1 project/issue chain every fixture builds on. */
export function setupTestDb(prefix: string): TestDb {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const dbPath = join(dir, "otomat.db");
  runMigrations(dbPath);
  const client = createClient(dbPath);
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: dir }).run();
  client.db.insert(schema.issues).values({ id: "i1", project_id: "p1", title: "I" }).run();
  return {
    client,
    db: client.db,
    dir,
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
