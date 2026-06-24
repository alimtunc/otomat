import type { Db } from "@otomat/db";
import type { RunContract, StartRunRequest } from "@otomat/domain";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  startedAt: string;
  dbPath: string;
  launchRun(request: StartRunRequest): Promise<RunContract>;
  /** Re-run a human-waiting run on an explicit operator action (resume-on-action, never auto). */
  resumeRun(runId: string): Promise<RunContract>;
  /** Cancel a run: kill its process group and write the canonical canceled state + event. */
  abortRun(runId: string, reason?: string): Promise<void>;
}
