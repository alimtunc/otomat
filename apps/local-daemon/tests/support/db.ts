import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, runMigrations, schema, type Db, type DbClient } from "@otomat/db";
import { eq } from "drizzle-orm";

export interface TestDb {
  client: DbClient;
  db: Db;
  dir: string;
  dbPath: string;
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
    dbPath,
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Seeds the repo-1 repository row under p1 so worktree FKs resolve. */
export function seedRepository(db: Db, defaultBranch = "main"): string {
  db.insert(schema.repositories)
    .values({ id: "repo-1", project_id: "p1", name: "R", default_branch: defaultBranch })
    .run();
  return "repo-1";
}

/** Points a project's root at a real git repo so the repository resolver builds a usable service. */
export function anchorProjectRoot(db: Db, rootPath: string, projectId = "p1"): void {
  db.update(schema.projects)
    .set({ root_path: rootPath })
    .where(eq(schema.projects.id, projectId))
    .run();
}
