import {
  agentProfileContractSchema,
  healthResponseSchema,
  githubConnectionContractSchema,
  issueContractSchema,
  issueSourceContractSchema,
  linearCommentsResponseSchema,
  linearConnectionContractSchema,
  linearEditorStateSchema,
  linearIssueDraftSchema,
  linearWorkspaceContractSchema,
  linearWritebackStateSchema,
  projectContractSchema,
  pullRequestDetailSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewDetailSchema,
  runContractSchema,
  runDetailSchema,
  registerRepositoryResponseSchema,
  runDiffResponseSchema,
  runtimeDescriptorSchema,
  skillContractSchema,
  syncLinearResponseSchema,
  type ConnectLinearRequest,
  type CreateIssueRequest,
  type CreateIssueSourceRequest,
  type CreateReviewCommentRequest,
  type FollowUpRunRequest,
  type PreparePullRequestRequest,
  type PublishCommentRequest,
  type PublishFieldsRequest,
  type PublishPrLinkRequest,
  type PublishStatusRequest,
  type RegisterRepositoryRequest,
  type RequestFixRequest,
  type SaveAgentProfileRequest,
  type SaveLinearDraftRequest,
  type SelectCompeteWinnerRequest,
  type SetSkillEnabledRequest,
  type StartRunRequest,
  type SyncLinearRequest,
} from "@otomat/domain";

import { deleteJson, getJson, patchJson, postJson, queryString } from "./http.js";
import { subscribeRunEvents } from "./sse.js";
import type { DaemonClientConfig, RunEventsHandlers, RunEventsSubscription } from "./types.js";

/**
 * Builds a typed daemon client bound to `config`. Each method issues one HTTP request
 * and validates the response against its zod contract, throwing `ZodError` on schema
 * drift and `DaemonRequestError` on a non-2xx status. Reads use GET, mutations send a
 * JSON body via POST/PATCH (deletes use DELETE); `subscribeRunEvents` instead opens an SSE stream.
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
    async getLinearConnection() {
      return linearConnectionContractSchema.parse(await getJson(config, "/api/linear/connection"));
    },
    async connectLinear(request: ConnectLinearRequest) {
      return linearConnectionContractSchema.parse(
        await postJson(config, "/api/linear/connect", request),
      );
    },
    async disconnectLinear() {
      return linearConnectionContractSchema.parse(
        await postJson(config, "/api/linear/disconnect", {}),
      );
    },
    async getLinearWorkspace() {
      return linearWorkspaceContractSchema.parse(await getJson(config, "/api/linear/workspace"));
    },
    async listIssueSources() {
      return issueSourceContractSchema.array().parse(await getJson(config, "/api/linear/sources"));
    },
    async createIssueSource(request: CreateIssueSourceRequest) {
      return issueSourceContractSchema.parse(
        await postJson(config, "/api/linear/sources", request),
      );
    },
    async syncLinear(request: SyncLinearRequest = {}) {
      return syncLinearResponseSchema.parse(await postJson(config, "/api/linear/sync", request));
    },
    async getLinearWriteback(issueId: string) {
      return linearWritebackStateSchema.parse(
        await getJson(config, `/api/linear/issues/${encodeURIComponent(issueId)}/writeback`),
      );
    },
    async getLinearEditor(issueId: string) {
      return linearEditorStateSchema.parse(
        await getJson(config, `/api/linear/issues/${encodeURIComponent(issueId)}/editor`),
      );
    },
    async getLinearComments(issueId: string) {
      return linearCommentsResponseSchema.parse(
        await getJson(config, `/api/linear/issues/${encodeURIComponent(issueId)}/comments`),
      ).comments;
    },
    async saveLinearDraft(issueId: string, request: SaveLinearDraftRequest) {
      return linearIssueDraftSchema.parse(
        await postJson(config, `/api/linear/issues/${encodeURIComponent(issueId)}/draft`, request),
      );
    },
    async discardLinearDraft(issueId: string) {
      return linearWritebackStateSchema.parse(
        await postJson(
          config,
          `/api/linear/issues/${encodeURIComponent(issueId)}/discard-draft`,
          {},
        ),
      );
    },
    async publishLinearFields(issueId: string, request: PublishFieldsRequest) {
      return linearWritebackStateSchema.parse(
        await postJson(
          config,
          `/api/linear/issues/${encodeURIComponent(issueId)}/publish-fields`,
          request,
        ),
      );
    },
    async publishLinearStatus(issueId: string, request: PublishStatusRequest) {
      return linearWritebackStateSchema.parse(
        await postJson(
          config,
          `/api/linear/issues/${encodeURIComponent(issueId)}/publish-status`,
          request,
        ),
      );
    },
    async publishLinearComment(issueId: string, request: PublishCommentRequest) {
      return linearWritebackStateSchema.parse(
        await postJson(
          config,
          `/api/linear/issues/${encodeURIComponent(issueId)}/publish-comment`,
          request,
        ),
      );
    },
    async publishLinearPrLink(issueId: string, request: PublishPrLinkRequest) {
      return linearWritebackStateSchema.parse(
        await postJson(
          config,
          `/api/linear/issues/${encodeURIComponent(issueId)}/publish-pr-link`,
          request,
        ),
      );
    },
    async retryLinearWrite(writeId: string) {
      return linearWritebackStateSchema.parse(
        await postJson(config, `/api/linear/writes/${encodeURIComponent(writeId)}/retry`, {}),
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
    async registerRepository(request: RegisterRepositoryRequest) {
      return registerRepositoryResponseSchema.parse(
        await postJson(config, "/api/repositories", request),
      );
    },
    async listRuntimes() {
      return runtimeDescriptorSchema.array().parse(await getJson(config, "/api/runtimes"));
    },
    async listAgentProfiles() {
      return agentProfileContractSchema.array().parse(await getJson(config, "/api/agent-profiles"));
    },
    async createAgentProfile(request: SaveAgentProfileRequest) {
      return agentProfileContractSchema.parse(
        await postJson(config, "/api/agent-profiles", request),
      );
    },
    async updateAgentProfile(id: string, request: SaveAgentProfileRequest) {
      return agentProfileContractSchema.parse(
        await patchJson(config, `/api/agent-profiles/${encodeURIComponent(id)}`, request),
      );
    },
    async duplicateAgentProfile(id: string) {
      return agentProfileContractSchema.parse(
        await postJson(config, `/api/agent-profiles/${encodeURIComponent(id)}/duplicate`, {}),
      );
    },
    async deleteAgentProfile(id: string) {
      await deleteJson(config, `/api/agent-profiles/${encodeURIComponent(id)}`);
    },
    async listSkills() {
      return skillContractSchema.array().parse(await getJson(config, "/api/skills"));
    },
    async scanSkills() {
      return skillContractSchema.array().parse(await postJson(config, "/api/skills/scan", {}));
    },
    async setSkillEnabled(id: string, request: SetSkillEnabledRequest) {
      return skillContractSchema.parse(
        await patchJson(config, `/api/skills/${encodeURIComponent(id)}`, request),
      );
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
    async listRuns(params: { issueId?: string; projectId?: string } = {}) {
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
