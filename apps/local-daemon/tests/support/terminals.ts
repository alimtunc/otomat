import { join } from "node:path";

import { createRepositoryResolver } from "#git";
import { TerminalService } from "#terminal";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { makeSupervisor } from "#test-support/supervisor";

export interface TerminalFixture {
  fix: DaemonTestDb;
  repositories: ReturnType<typeof createRepositoryResolver>;
  harness: ReturnType<typeof makeSupervisor>;
  terminals: TerminalService;
}

export function setupTerminals(): TerminalFixture {
  const fix = setupDaemonDb();
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const harness = makeSupervisor(fix, "complete", { repositories });
  const terminals = new TerminalService(fix.db, repositories, harness.supervisor);
  return { fix, repositories, harness, terminals };
}

export async function closeTerminals(terminals: TerminalService, fix: DaemonTestDb): Promise<void> {
  try {
    await terminals.shutdown();
  } finally {
    fix.cleanup();
  }
}
