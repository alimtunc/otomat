import {
  appendedRunStepResponseSchema,
  runContractSchema,
  runSummarySchema,
  runCommitsResponseSchema,
  runCompletionReportResponseSchema,
  runContributionContractSchema,
  runContributionsResponseSchema,
  runDetailSchema,
  runInteractionContractSchema,
  runInteractionsResponseSchema,
  reviewDiffResponseSchema,
  runEventWindowSchema,
  runLaunchResponseSchema,
  runUsageResponseSchema,
  sessionContextResponseSchema,
  workspaceClosureSummarySchema,
  type AppendRunStepRequest,
  type AnswerRunInteractionRequest,
  type CreateRunContributionRequest,
  type ScheduleProviderResumeRequest,
  type SelectCompeteWinnerRequest,
  type StartRunRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postForm, postJson, queryString, resolveUrl } from "./http.js";

function contributionForm(
  request: CreateRunContributionRequest,
  images: readonly Blob[],
): FormData {
  const form = new FormData();
  form.set("request", JSON.stringify(request));
  for (const image of images) form.append("images", image);
  return form;
}

export function createRunsClient(config: DaemonClientConfig) {
  return {
    async listRunSummaries(projectId: string) {
      return runSummarySchema
        .array()
        .parse(await getJson(config, `/api/runs/catalog${queryString({ projectId })}`));
    },
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
    async scheduleProviderResume(id: string, request: ScheduleProviderResumeRequest) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/provider-wait`, request),
      );
    },
    async getSessionContext(id: string, agentSessionId: string) {
      return sessionContextResponseSchema.parse(
        await getJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/sessions/${encodeURIComponent(agentSessionId)}/context`,
        ),
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
      return appendedRunStepResponseSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/steps`, request),
      );
    },
    async listRunContributions(id: string) {
      return runContributionsResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/contributions`),
      );
    },
    async createRunContribution(
      id: string,
      request: CreateRunContributionRequest,
      images: readonly Blob[],
    ) {
      const path = `/api/runs/${encodeURIComponent(id)}/contributions`;
      return runContributionContractSchema.parse(
        images.length === 0
          ? await postJson(config, path, request)
          : await postForm(config, path, contributionForm(request, images)),
      );
    },
    runContributionImageUrl(id: string, contributionId: string, imageId: string) {
      return resolveUrl(
        config,
        `/api/runs/${encodeURIComponent(id)}/contributions/${encodeURIComponent(contributionId)}/images/${encodeURIComponent(imageId)}`,
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
    async listRunInteractions(id: string) {
      return runInteractionsResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/interactions`),
      );
    },
    async answerRunInteraction(
      id: string,
      interactionId: string,
      request: AnswerRunInteractionRequest,
    ) {
      return runInteractionContractSchema.parse(
        await postJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/interactions/${encodeURIComponent(interactionId)}/answer`,
          request,
        ),
      );
    },
    async abortRun(id: string) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abort`, {}),
      );
    },
    async getCompeteCandidateDiff(id: string, groupId: string, stepId: string) {
      return reviewDiffResponseSchema.parse(
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
    async getRunUsage(id: string) {
      return runUsageResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/usage`),
      );
    },
    async getRunCommits(id: string) {
      return runCommitsResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/commits`),
      );
    },
  };
}
