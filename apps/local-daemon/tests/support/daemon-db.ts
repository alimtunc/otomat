import type { Db, DbClient } from "@otomat/db";

import { anchorProjectRoot, seedRepository, setupTestDb } from "./db.js";
import { setupTestRepo, type TestRepo } from "./git.js";

export interface DaemonTestDb {
  client: DbClient;
  db: Db;
  dbPath: string;
  /** Root the supervisor writes `runs/<id>/events.jsonl` under (mirrors `dirname(dbPath)`). */
  dataDir: string;
  /** Real git repository `p1` points at; every launch forks its run worktree from here. */
  repo: TestRepo;
  repositoryId: string;
  cleanup(): void;
}

/**
 * The daemon fixture always owns a usable repository, because a launch that
 * cannot obtain one is refused — a supervisor test without a repo would only
 * ever exercise the refusal path.
 */
export function setupDaemonDb(): DaemonTestDb {
  const base = setupTestDb("otomat-daemon-");
  const repo = setupTestRepo();
  anchorProjectRoot(base.db, repo.root);
  const repositoryId = seedRepository(base.db, repo.defaultBranch);
  return {
    client: base.client,
    db: base.db,
    dbPath: base.dbPath,
    dataDir: base.dir,
    repo,
    repositoryId,
    cleanup() {
      base.cleanup();
      repo.cleanup();
    },
  };
}
