import {
  runContractSchema,
  runCompletionReportResponseSchema,
  runContributionContractSchema,
  runContributionsResponseSchema,
  runDetailSchema,
  runDiffResponseSchema,
  runEventWindowSchema,
  runLaunchResponseSchema,
  workspaceClosureSummarySchema,
  type AppendRunStepRequest,
  type CreateRunContributionRequest,
  type SelectCompeteWinnerRequest,
  type StartRunRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

export function createRunsClient(config: DaemonClientConfig) {
  return {
    async listRuns(params: { issueId?: string; projectId?: string } = {}) {
      return runContractSchema
        .array()
        .parse(await getJson(config, `/api/runs${queryString(params)}`));
    },
    async getRun(id: string) {
      return runDetailSchema.parse(await getJson(config, `/api/runs/${encodeURIComponent(id)}`));
    },
    async getRunCompletionReport(id: string) {
      return runCompletionReportResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/report`),
      );
    },
    async startRun(request: StartRunRequest) {
      return runLaunchResponseSchema.parse(await postJson(config, "/api/runs", request));
    },
    async resumeRun(id: string) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/resume`, {}),
      );
    },
    async getRunWorkspace(id: string) {
      return workspaceClosureSummarySchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/workspace`),
      );
    },
    async abandonRunWorkspace(id: string) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abandon`, {}),
      );
    },
    async appendRunStep(id: string, request: AppendRunStepRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/steps`, request),
      );
    },
    async listRunContributions(id: string) {
      return runContributionsResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/contributions`),
      );
    },
    async createRunContribution(id: string, request: CreateRunContributionRequest) {
      return runContributionContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/contributions`, request),
      );
    },
    async deliverRunContributions(id: string) {
      return runContributionsResponseSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/contributions/deliver`, {}),
      );
    },
    async retryRunContribution(id: string, contributionId: string) {
      return runContributionContractSchema.parse(
        await postJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/contributions/${encodeURIComponent(contributionId)}/retry`,
          {},
        ),
      );
    },
    async cancelRunContribution(id: string, contributionId: string) {
      return runContributionContractSchema.parse(
        await postJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/contributions/${encodeURIComponent(contributionId)}/cancel`,
          {},
        ),
      );
    },
    async abortRun(id: string) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abort`, {}),
      );
    },
    async getCompeteCandidateDiff(id: string, groupId: string, stepId: string) {
      return runDiffResponseSchema.parse(
        await getJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/compete-groups/${encodeURIComponent(groupId)}/candidates/${encodeURIComponent(stepId)}/diff`,
        ),
      );
    },
    async selectCompeteWinner(id: string, groupId: string, request: SelectCompeteWinnerRequest) {
      return runDetailSchema.parse(
        await postJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/compete-groups/${encodeURIComponent(groupId)}/winner`,
          request,
        ),
      );
    },
    async getRunEventWindow(id: string, params: { before?: number; limit?: number } = {}) {
      const query = queryString({
        before: params.before?.toString(),
        limit: params.limit?.toString(),
      });
      return runEventWindowSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/events/window${query}`),
      );
    },
    async getRunDiff(id: string) {
      return runDiffResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/diff`),
      );
    },
  };
}
