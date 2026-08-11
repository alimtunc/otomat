import {
  issueSourceContractSchema,
  linearCommentsResponseSchema,
  linearConnectionContractSchema,
  linearEditorStateSchema,
  linearIssueDraftSchema,
  linearSyncStatusSchema,
  linearWorkspaceContractSchema,
  linearWritebackStateSchema,
  syncLinearResponseSchema,
  type ConnectLinearRequest,
  type CreateIssueSourceRequest,
  type PublishCommentRequest,
  type PublishFieldsRequest,
  type PublishPrLinkRequest,
  type PublishStatusRequest,
  type SaveLinearDraftRequest,
  type SyncLinearRequest,
  type UpdateIssueSourceRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, patchJson, postJson, queryString } from "./http.js";

export function createLinearClient(config: DaemonClientConfig) {
  return {
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
    async listIssueSources(params: { projectId?: string } = {}) {
      return issueSourceContractSchema
        .array()
        .parse(await getJson(config, `/api/linear/sources${queryString(params)}`));
    },
    async createIssueSource(request: CreateIssueSourceRequest) {
      return issueSourceContractSchema.parse(
        await postJson(config, "/api/linear/sources", request),
      );
    },
    async updateIssueSource(sourceId: string, request: UpdateIssueSourceRequest) {
      return issueSourceContractSchema.parse(
        await patchJson(config, `/api/linear/sources/${encodeURIComponent(sourceId)}`, request),
      );
    },
    async deleteIssueSource(sourceId: string) {
      await deleteJson(config, `/api/linear/sources/${encodeURIComponent(sourceId)}`);
    },
    async syncLinear(request: SyncLinearRequest = {}) {
      return syncLinearResponseSchema.parse(await postJson(config, "/api/linear/sync", request));
    },
    async getLinearSyncStatus(projectId: string) {
      return linearSyncStatusSchema.parse(
        await getJson(config, `/api/linear/sync-status${queryString({ projectId })}`),
      );
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
  };
}
