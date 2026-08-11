import type { Db, RunContributionRow, RunRow } from "@otomat/db";
import type {
  AgentCapacity,
  RunWait,
  SchemaMetadataContract,
  StartRunRequest,
} from "@otomat/domain";

import type { GitHubService } from "#github";
import type { LinearService } from "#linear";
import type { ReviewService } from "#review";
import type { AppendStepInput } from "#supervisor";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  build: string | null;
  startedAt: string;
  dbPath: string;
  schemaMetadata(): SchemaMetadataContract;
  launchRun(request: StartRunRequest): Promise<RunRow>;
  runWait(runId: string): RunWait | null;
  agentCapacity(): AgentCapacity;
  setAgentCapacity(maxConcurrentSessions: number): AgentCapacity;
  resumeRun(runId: string): Promise<RunRow>;
  appendRunStep(runId: string, input: AppendStepInput): Promise<RunRow>;
  contributeToRun(runId: string, stepRunId: string, body: string): Promise<RunContributionRow>;
  retryRunContribution(runId: string, contributionId: string): Promise<RunContributionRow>;
  cancelRunContribution(runId: string, contributionId: string): RunContributionRow;
  deliverRunContributions(runId: string): Promise<void>;
  selectCompeteWinner(runId: string, groupId: string, stepRunId: string): Promise<void>;
  abortRun(runId: string): Promise<void>;
  github: GitHubService;
  linear: LinearService;
  review: ReviewService;
}
