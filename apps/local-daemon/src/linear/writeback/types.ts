import type { Db, IssueRow } from "@otomat/db";
import type {
  LinearCommentContract,
  LinearEditorState,
  LinearIssueDraft,
  LinearWriteKind,
  LinearWritebackState,
  PublishCommentRequest,
  PublishFieldsRequest,
  PublishPrLinkRequest,
  PublishStatusRequest,
  SaveLinearDraftRequest,
} from "@otomat/domain";

import type { LinearApiClient } from "../client/types.js";

export interface LinearWritebackConfig {
  db: Db;
  dataDir: string;
  client: LinearApiClient;
  idFactory: () => string;
  now: () => Date;
  authorize: () => { apiKey: string; signal: AbortSignal };
  guard: <T>(signal: AbortSignal, call: () => Promise<T>) => Promise<T>;
}

export interface WritableIssue {
  issue: IssueRow;
  linearId: string;
}

export interface WriteOutcome {
  remote_id: string | null;
  detail: string | null;
}

export interface PendingSpec {
  issueId: string;
  runId: string | null;
  kind: LinearWriteKind;
  key: string;
  payload: unknown;
  detail: string;
}

export interface LinearFieldsPayload {
  title: string;
  description: string | null;
  priority: number;
  assignee_id: string | null;
  label_ids: string[];
}

export interface LinearWriteback {
  writebackState(issueId: string): LinearWritebackState;
  editorState(issueId: string): Promise<LinearEditorState>;
  comments(issueId: string): Promise<LinearCommentContract[]>;
  saveDraft(issueId: string, request: SaveLinearDraftRequest): LinearIssueDraft;
  discardDraft(issueId: string): void;
  publishFields(issueId: string, request: PublishFieldsRequest): Promise<LinearWritebackState>;
  publishStatus(issueId: string, request: PublishStatusRequest): Promise<LinearWritebackState>;
  publishComment(issueId: string, request: PublishCommentRequest): Promise<LinearWritebackState>;
  publishPrLink(issueId: string, request: PublishPrLinkRequest): Promise<LinearWritebackState>;
  retryWrite(writeId: string): Promise<LinearWritebackState>;
}
