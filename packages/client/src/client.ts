import {
  healthResponseSchema,
  githubConnectionContractSchema,
  issueContractSchema,
  projectContractSchema,
  pullRequestDetailSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewDetailSchema,
  runContractSchema,
  runDetailSchema,
  runDiffResponseSchema,
  runtimeDescriptorSchema,
  type CreateIssueRequest,
  type CreateReviewCommentRequest,
  type FollowUpRunRequest,
  type PreparePullRequestRequest,
  type RequestFixRequest,
  type StartRunRequest,
} from "@otomat/domain";

import { getJson, postJson, queryString } from "./http";
import { subscribeRunEvents } from "./sse";
import type { DaemonClientConfig, RunEventsHandlers, RunEventsSubscription } from "./types";

/**
 * Builds a typed daemon client bound to `config`. Each method issues one HTTP request
 * and validates the response against its zod contract, throwing `ZodError` on schema
 * drift and `DaemonRequestError` on a non-2xx status. Reads use GET, mutations POST a
 * JSON body; `subscribeRunEvents` instead opens an SSE stream (see `subscribeRunEvents`).
 */
export function createDaemonClient(config: DaemonClientConfig = {}) {
  return {
    async health() {
      return healthResponseSchema.parse(await getJson(config, "/api/health"));
    },
    async getGitHubConnection() {
      return githubConnectionContractSchema.parse(await getJson(config, "/api/github/connection"));
    },
    async connectGitHub() {
      return githubConnectionContractSchema.parse(
        await postJson(config, "/api/github/connect", {}),
      );
    },
    async listProjects() {
      return projectContractSchema.array().parse(await getJson(config, "/api/projects"));
    },
    async listRepositories(params: { projectId?: string } = {}) {
      return repositoryContractSchema
        .array()
        .parse(await getJson(config, `/api/repositories${queryString(params)}`));
    },
    async listRuntimes() {
      return runtimeDescriptorSchema.array().parse(await getJson(config, "/api/runtimes"));
    },
    async listIssues(params: { projectId?: string } = {}) {
      return issueContractSchema
        .array()
        .parse(await getJson(config, `/api/issues${queryString(params)}`));
    },
    async createIssue(request: CreateIssueRequest) {
      return issueContractSchema.parse(await postJson(config, "/api/issues", request));
    },
    async getIssue(id: string) {
      return issueContractSchema.parse(
        await getJson(config, `/api/issues/${encodeURIComponent(id)}`),
      );
    },
    async listRuns(params: { issueId?: string } = {}) {
      return runContractSchema
        .array()
        .parse(await getJson(config, `/api/runs${queryString(params)}`));
    },
    async getRun(id: string) {
      return runDetailSchema.parse(await getJson(config, `/api/runs/${encodeURIComponent(id)}`));
    },
    async startRun(request: StartRunRequest) {
      return runContractSchema.parse(await postJson(config, "/api/runs", request));
    },
    async resumeRun(id: string) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/resume`, {}),
      );
    },
    async followUpRun(id: string, request: FollowUpRunRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/follow-up`, request),
      );
    },
    async abortRun(id: string) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abort`, {}),
      );
    },
    async getRunDiff(id: string) {
      return runDiffResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/diff`),
      );
    },
    async getRunReview(id: string) {
      return reviewDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/review`),
      );
    },
    async addReviewComment(id: string, request: CreateReviewCommentRequest) {
      return reviewCommentContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/review/comments`, request),
      );
    },
    async requestFix(id: string, request: RequestFixRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/review/fix`, request),
      );
    },
    async getPullRequest(id: string) {
      return pullRequestDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/pr`),
      );
    },
    async preparePullRequest(id: string, request: PreparePullRequestRequest) {
      return pullRequestDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/pr`, request),
      );
    },
    subscribeRunEvents(runId: string, handlers: RunEventsHandlers): RunEventsSubscription {
      return subscribeRunEvents(config, runId, handlers);
    },
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
