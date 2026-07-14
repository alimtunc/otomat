import type { Db, RunRow } from "@otomat/db";
import type { StartRunRequest } from "@otomat/domain";

import type { GitHubService } from "#github";
import type { ReviewService } from "#review";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  startedAt: string;
  dbPath: string;
  launchRun(request: StartRunRequest): Promise<RunRow>;
  resumeRun(runId: string): Promise<RunRow>;
  fixRun(runId: string, prompt: string): Promise<RunRow>;
  abortRun(runId: string): Promise<void>;
  github: GitHubService;
  review: ReviewService;
}
