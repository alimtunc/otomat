import { getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createSupervisor, isProcessAlive, type SpawnSession, type Supervisor } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { workerSpawn } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("shutdown terminates every in-flight worker and drains to a settled state", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");

  const first = await supervisor.start({ prompt: "long task a" });
  const second = await supervisor.start({ prompt: "long task b" });
  expect(getRun(fix.db, first.id)?.status).toBe("running");
  expect(getRun(fix.db, second.id)?.status).toBe("running");

  await supervisor.shutdown(50);
  await supervisor.settle();

  // Both lingering workers were signaled; neither run is left non-terminal.
  for (const id of [first.id, second.id]) {
    const status = getRun(fix.db, id)?.status;
    expect(status).toBeDefined();
    expect(status).not.toBe("running");
  }
});

it("shutdown is a no-op when nothing is in flight", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "quick task" });
  await supervisor.settle();

  await expect(supervisor.shutdown(50)).resolves.toBeUndefined();
  expect(getRun(fix.db, run.id)?.status).not.toBe("running");
});

it("never releases a spawned worker when shutdown lands during durable startup", async () => {
  const worker = workerSpawn("linger");
  let supervisor: Supervisor;
  let shuttingDown: Promise<void> | null = null;
  let released = 0;
  let workerPid = -1;
  const spawn: SpawnSession = (job) => {
    const proc = worker(job);
    workerPid = proc.pid;
    const release = proc.start;
    proc.start = () => {
      released += 1;
      release();
    };
    shuttingDown = supervisor.shutdown(50);
    return proc;
  };
  supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: `${fix.dataDir}/worktrees`,
    }),
  });

  const run = await supervisor.start({ prompt: "shutdown in the start gate" });
  if (!shuttingDown) throw new Error("shutdown did not start during spawn");
  await shuttingDown;

  expect(released).toBe(0);
  expect(isProcessAlive(workerPid)).toBe(false);
  expect(getRun(fix.db, run.id)?.status).not.toBe("running");
});
