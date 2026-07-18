import { join } from "node:path";

import { createRepositoryResolver } from "#git";
import { createSupervisor, type Supervisor, type SupervisorConfig } from "#supervisor";

import type { DaemonTestDb } from "./daemon-db.js";
import { workerSpawn, type WorkerBehavior } from "./spawn.js";

export interface TestSupervisor {
  supervisor: Supervisor;
  spawn: ReturnType<typeof workerSpawn>;
}

/** A supervisor wired to the fixture db and a real fake-worker spawn. */
export function makeSupervisor(
  fix: DaemonTestDb,
  behavior: WorkerBehavior | WorkerBehavior[],
  overrides: Partial<Omit<SupervisorConfig, "spawn">> = {},
): TestSupervisor {
  const spawn = workerSpawn(behavior);
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
    ...overrides,
  });
  return { supervisor, spawn };
}
