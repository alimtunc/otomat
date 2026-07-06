import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, type DbClient } from "#db/client";
import { schema } from "#db/index";
import { runMigrations } from "#db/migrate";

export interface TempDb {
  client: DbClient;
  path: string;
  cleanup(): void;
}

/** Fresh migrated SQLite in its own temp dir; unseeded so schema tests can boot bare. */
export function createTempDb(prefix: string): TempDb {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const path = join(dir, "otomat.db");
  runMigrations(path);
  const client = createClient(path);
  return {
    client,
    path,
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function seedProject(db: DbClient["db"], id = "p1"): void {
  db.insert(schema.projects).values({ id, name: "P", root_path: "/tmp/p" }).run();
}

/** Seeds the p1/i1/r1 chain the review and pull-request repositories hang off. */
export function seedReviewRun(db: DbClient["db"]): void {
  seedProject(db);
  db.insert(schema.issues)
    .values({ id: "i1", project_id: "p1", title: "Issue", status: "ready" })
    .run();
  db.insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "i1",
      status: "review_ready",
      branch: "otomat/run/r1",
      plan_json: { version: 1, steps: [] },
    })
    .run();
}
