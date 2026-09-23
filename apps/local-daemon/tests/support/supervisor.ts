import { join } from "node:path";

import { writeMaxConcurrentSessions } from "@otomat/db";

import { createRepositoryResolver } from "#git";
import {
  createSupervisor,
  type AppendStepInput,
  type Supervisor,
  type SupervisorConfig,
} from "#supervisor";

import type { DaemonTestDb } from "./daemon-db.js";
import { workerSpawn, type WorkerBehavior } from "./spawn.js";

export interface TestSupervisor {
  supervisor: Supervisor;
  spawn: ReturnType<typeof workerSpawn>;
}

export interface MakeSupervisorOptions extends Partial<Omit<SupervisorConfig, "spawn">> {
  /** Seeded as the host's persisted cap before the supervisor reads it, exactly as a saved setting would be. */
  concurrency?: number;
}

/** A supervisor wired to the fixture db and a real fake-worker spawn. */
export function makeSupervisor(
  fix: DaemonTestDb,
  behavior: WorkerBehavior | WorkerBehavior[],
  options: MakeSupervisorOptions = {},
): TestSupervisor {
  const { concurrency, ...overrides } = options;
  if (concurrency !== undefined) writeMaxConcurrentSessions(fix.db, concurrency);
  const spawn = workerSpawn(behavior);
  return { supervisor: supervisorWithSpawn(fix, spawn, overrides), spawn };
}

export function supervisorWithSpawn(
  fix: DaemonTestDb,
  spawn: SupervisorConfig["spawn"],
  overrides: Partial<Omit<SupervisorConfig, "spawn">> = {},
): Supervisor {
  return createSupervisor({
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
}

export function appendStepInput(overrides: Partial<AppendStepInput> = {}): AppendStepInput {
  return {
    name: "Follow up",
    note: null,
    references: [],
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    dependsOn: [],
    parallel: false,
    replaces: null,
    origin: "user",
    ...overrides,
  };
}
