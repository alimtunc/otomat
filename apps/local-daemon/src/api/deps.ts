import type { Db, RunRow } from "@otomat/db";
import type { StartRunRequest } from "@otomat/domain";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  startedAt: string;
  dbPath: string;
  launchRun(request: StartRunRequest): Promise<RunRow>;
  resumeRun(runId: string): Promise<RunRow>;
  abortRun(runId: string): Promise<void>;
}
