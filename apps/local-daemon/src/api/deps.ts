import type { Db, RunContributionRow, RunRow } from "@otomat/db";
import type { SchemaMetadataContract, StartRunRequest } from "@otomat/domain";

import type { GitHubService } from "#github";
import type { LinearService } from "#linear";
import type { ReviewService } from "#review";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  startedAt: string;
  dbPath: string;
  schemaMetadata(): SchemaMetadataContract;
  launchRun(request: StartRunRequest): Promise<RunRow>;
  resumeRun(runId: string): Promise<RunRow>;
  fixRun(runId: string, prompt: string): Promise<RunRow>;
  contributeToRun(runId: string, body: string): Promise<RunContributionRow>;
  retryRunContribution(runId: string, contributionId: string): Promise<RunContributionRow>;
  deliverRunContributions(runId: string): Promise<void>;
  selectCompeteWinner(runId: string, groupId: string, stepRunId: string): Promise<void>;
  abortRun(runId: string): Promise<void>;
  github: GitHubService;
  linear: LinearService;
  review: ReviewService;
}
