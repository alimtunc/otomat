import { createSupervisor, type Supervisor, type SupervisorConfig } from "#supervisor";

import type { DaemonTestDb } from "./daemon-db.js";
import { workerSpawn } from "./spawn.js";

export interface TestSupervisor {
  supervisor: Supervisor;
  spawn: ReturnType<typeof workerSpawn>;
}

/** A supervisor wired to the fixture db and a real fake-worker spawn. */
export function makeSupervisor(
  fix: DaemonTestDb,
  behavior: Parameters<typeof workerSpawn>[0],
  overrides: Partial<Omit<SupervisorConfig, "spawn">> = {},
): TestSupervisor {
  const spawn = workerSpawn(behavior);
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    ...overrides,
  });
  return { supervisor, spawn };
}
