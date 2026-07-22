import {
  deleteLinearDraft,
  getIssue,
  getLinearDraft,
  getLinearWrite,
  getLinearWriteByIdentity,
  insertLinearWrite,
  type IssueRow,
  type LinearDraftRow,
  type LinearWriteRow,
  listLinearWritesForIssue,
  type Db,
  updateLinearWrite,
  upsertLinearDraft,
  upsertMirroredIssue,
} from "@otomat/db";
import {
  linearWriteMachine,
  type LinearCommentContract,
  type LinearEditorState,
  type LinearIssueDraft,
  type LinearIssueSnapshot,
  type LinearWriteContract,
  type LinearWriteKind,
  type LinearWriteState,
  type LinearWritebackState,
  type PublishCommentRequest,
  type PublishFieldsRequest,
  type PublishPrLinkRequest,
  type PublishStatusRequest,
  type SaveLinearDraftRequest,
} from "@otomat/domain";
import { z } from "zod";

import { emitLedgerEvent } from "#events";

import { LinearError, linearError, LinearWriteConflictError } from "./errors.js";
import { buildLinearWriteEvent, linearWriteEventType } from "./events.js";
import { issueStateFromLinear } from "./sync.js";
import type {
  LinearApiClient,
  LinearIssueDetail,
  LinearIssueUpdate,
  LinearWriteback,
} from "./types.js";

export interface LinearWritebackConfig {
  db: Db;
  dataDir: string;
  client: LinearApiClient;
  idFactory: () => string;
  now: () => Date;
  authorize: () => { apiKey: string; signal: AbortSignal };
  guard: <T>(signal: AbortSignal, call: () => Promise<T>) => Promise<T>;
}

interface WritableIssue {
  issue: IssueRow;
  linearId: string;
}

interface WriteOutcome {
  remote_id: string | null;
  detail: string | null;
}

interface PendingSpec {
  issueId: string;
  runId: string | null;
  kind: LinearWriteKind;
  key: string;
  payload: unknown;
  detail: string;
}

const statusPayloadSchema = z.object({ state_id: z.string() });
const commentPayloadSchema = z.object({ body: z.string(), parent_id: z.string().nullable() });
const prLinkPayloadSchema = z.object({ url: z.string(), title: z.string() });
const fieldsPayloadSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  assignee_id: z.string().nullable(),
  label_ids: z.array(z.string()),
});

/** SQLite CURRENT_TIMESTAMP is a UTC "YYYY-MM-DD HH:MM:SS" string, not ISO-8601. */
function sqliteToIso(timestamp: string): string {
  return timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`;
}

function labelsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

function draftMatchesRemote(draft: LinearDraftRow, remote: LinearIssueDetail): boolean {
  return (
    draft.title === remote.title &&
    (draft.description ?? "") === (remote.description ?? "") &&
    draft.priority === remote.priority &&
    (draft.assignee_id ?? null) === (remote.assignee?.id ?? null) &&
    labelsEqual(
      draft.label_ids,
      remote.labels.map((label) => label.id),
    )
  );
}

function fieldChanges(draft: LinearDraftRow, remote: LinearIssueDetail): LinearIssueUpdate {
  const input: LinearIssueUpdate = {};
  if (draft.title !== remote.title) input.title = draft.title;
  if ((draft.description ?? "") !== (remote.description ?? "")) {
    input.description = draft.description ?? "";
  }
  if (draft.priority !== remote.priority) input.priority = draft.priority;
  if ((draft.assignee_id ?? null) !== (remote.assignee?.id ?? null)) {
    input.assigneeId = draft.assignee_id;
  }
  if (
    !labelsEqual(
      draft.label_ids,
      remote.labels.map((label) => label.id),
    )
  ) {
    input.labelIds = draft.label_ids;
  }
  return input;
}

function snapshotToContract(detail: LinearIssueDetail): LinearIssueSnapshot {
  return {
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    assignee_id: detail.assignee?.id ?? null,
    label_ids: detail.labels.map((label) => label.id),
    external_id: detail.external_id,
    identifier: detail.identifier,
    url: detail.url,
    updated_at: detail.updated_at,
    assignee: detail.assignee,
    labels: detail.labels,
    state: detail.state,
  };
}

function safeLinearFailure(error: unknown): { code: string; message: string } {
  if (error instanceof LinearError) return { code: error.code, message: error.message };
  return { code: "linear_request_failed", message: "Linear returned an unexpected response." };
}

class DefaultLinearWriteback implements LinearWriteback {
  private readonly active = new Set<string>();

  constructor(private readonly config: LinearWritebackConfig) {}

  writebackState(issueId: string): LinearWritebackState {
    return this.state(issueId);
  }

  async editorState(issueId: string): Promise<LinearEditorState> {
    const { linearId } = this.requireWritableIssue(issueId);
    const { apiKey, signal } = this.config.authorize();
    const editor = await this.config.guard(signal, () =>
      this.config.client.issueEditor(apiKey, linearId, signal),
    );
    return {
      snapshot: snapshotToContract(editor.issue),
      team_metadata: {
        team_id: editor.team.team_id,
        states: editor.team.states,
        members: editor.team.members,
        labels: editor.team.labels,
      },
    };
  }

  async comments(issueId: string): Promise<LinearCommentContract[]> {
    const { linearId } = this.requireWritableIssue(issueId);
    const { apiKey, signal } = this.config.authorize();
    const remote = await this.config.guard(signal, () =>
      this.config.client.listComments(apiKey, linearId, signal),
    );
    return remote.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
  }

  saveDraft(issueId: string, request: SaveLinearDraftRequest): LinearIssueDraft {
    this.requireWritableIssue(issueId);
    const existing = getLinearDraft(this.config.db, issueId);
    upsertLinearDraft(this.config.db, {
      id: existing?.id ?? this.config.idFactory(),
      issue_id: issueId,
      base_updated_at: request.base_updated_at,
      title: request.title,
      description: request.description,
      priority: request.priority,
      assignee_id: request.assignee_id,
      label_ids: request.label_ids,
    });
    const saved = getLinearDraft(this.config.db, issueId);
    if (!saved) throw new Error(`linear draft for issue ${issueId} vanished`);
    return this.toDraftContract(saved);
  }

  discardDraft(issueId: string): void {
    deleteLinearDraft(this.config.db, issueId);
  }

  async publishStatus(
    issueId: string,
    request: PublishStatusRequest,
  ): Promise<LinearWritebackState> {
    const { issue, linearId } = this.requireWritableIssue(issueId);
    const key = request.state_id;
    const existing = getLinearWriteByIdentity(this.config.db, issueId, "status", key);
    if (existing?.status === "sent") return this.state(issueId);
    if (existing && this.active.has(existing.id)) return this.state(issueId);
    const write = this.ensurePending(existing, {
      issueId,
      runId: request.run_id ?? null,
      kind: "status",
      key,
      payload: { state_id: request.state_id },
      detail: "Publish status",
    });
    await this.runWrite(write, async (apiKey, signal) => {
      const remote = await this.config.client.issueSnapshot(apiKey, linearId, signal);
      const updated =
        remote.state.id === key
          ? remote
          : await this.config.client.updateIssue(apiKey, linearId, { stateId: key }, signal);
      this.refreshMirror(issue, updated);
      return { remote_id: updated.external_id, detail: `Status → ${updated.state.name}` };
    });
    return this.state(issueId);
  }

  async publishComment(
    issueId: string,
    request: PublishCommentRequest,
  ): Promise<LinearWritebackState> {
    const { linearId } = this.requireWritableIssue(issueId);
    const key = request.client_id;
    const existing = getLinearWriteByIdentity(this.config.db, issueId, "comment", key);
    if (existing?.status === "sent") return this.state(issueId);
    if (existing && this.active.has(existing.id)) return this.state(issueId);
    const parentId = request.parent_id ?? null;
    const write = this.ensurePending(existing, {
      issueId,
      runId: request.run_id ?? null,
      kind: "comment",
      key,
      payload: { body: request.body, parent_id: parentId },
      detail: commentDetail(request.body),
    });
    await this.runWrite(write, async (apiKey, signal) => {
      const remoteComments = await this.config.client.listComments(apiKey, linearId, signal);
      const remoteId = remoteComments.some((comment) => comment.id === key)
        ? key
        : await this.config.client.createComment(
            apiKey,
            {
              id: key,
              issueId: linearId,
              body: request.body,
              ...(parentId === null ? {} : { parentId }),
            },
            signal,
          );
      return { remote_id: remoteId, detail: commentDetail(request.body) };
    });
    return this.state(issueId);
  }

  async publishPrLink(
    issueId: string,
    request: PublishPrLinkRequest,
  ): Promise<LinearWritebackState> {
    const { linearId } = this.requireWritableIssue(issueId);
    const key = request.url;
    const existing = getLinearWriteByIdentity(this.config.db, issueId, "pr_link", key);
    if (existing?.status === "sent") return this.state(issueId);
    if (existing && this.active.has(existing.id)) return this.state(issueId);
    const write = this.ensurePending(existing, {
      issueId,
      runId: request.run_id ?? null,
      kind: "pr_link",
      key,
      payload: { url: request.url, title: request.title },
      detail: request.url,
    });
    await this.runWrite(write, async (apiKey, signal) => {
      const attachmentId = await this.config.client.linkAttachment(
        apiKey,
        { issueId: linearId, url: request.url, title: request.title },
        signal,
      );
      return { remote_id: attachmentId, detail: request.url };
    });
    return this.state(issueId);
  }

  async publishFields(
    issueId: string,
    request: PublishFieldsRequest,
  ): Promise<LinearWritebackState> {
    const { issue, linearId } = this.requireWritableIssue(issueId);
    const draft = getLinearDraft(this.config.db, issueId);
    if (!draft) throw linearError("linear_write_not_found");
    const key = draft.id;
    const existing = getLinearWriteByIdentity(this.config.db, issueId, "fields", key);
    if (existing?.status === "sent") {
      // Self-heal a crash between markSent and the draft delete — but never eat
      // a draft the user re-edited since that publish.
      if (draftMatchesPayload(draft, existing.payload_json)) {
        deleteLinearDraft(this.config.db, issueId);
      }
      return this.state(issueId);
    }
    if (existing && this.active.has(existing.id)) return this.state(issueId);
    const write = this.ensurePending(existing, {
      issueId,
      runId: null,
      kind: "fields",
      key,
      payload: fieldsPayload(draft),
      detail: "Publish fields",
    });
    await this.runWrite(write, async (apiKey, signal) => {
      const remote = await this.config.client.issueSnapshot(apiKey, linearId, signal);
      if (draftMatchesRemote(draft, remote)) {
        this.refreshMirror(issue, remote);
        return { remote_id: remote.updated_at, detail: "Already up to date on Linear" };
      }
      if (remote.updated_at !== draft.base_updated_at && !request.overwrite) {
        throw new LinearWriteConflictError(snapshotToContract(remote));
      }
      const changes = fieldChanges(draft, remote);
      const updated =
        Object.keys(changes).length === 0
          ? remote
          : await this.config.client.updateIssue(apiKey, linearId, changes, signal);
      this.refreshMirror(issue, updated);
      return { remote_id: updated.updated_at, detail: "Published fields to Linear" };
    });
    deleteLinearDraft(this.config.db, issueId);
    return this.state(issueId);
  }

  async retryWrite(writeId: string): Promise<LinearWritebackState> {
    const write = getLinearWrite(this.config.db, writeId);
    if (!write) throw linearError("linear_write_not_found");
    if (write.status === "sent") return this.state(write.issue_id);
    const runId = write.run_id;
    switch (write.kind) {
      case "status":
        return this.publishStatus(write.issue_id, {
          state_id: parsePayload(statusPayloadSchema, write.payload_json).state_id,
          run_id: runId,
        });
      case "comment": {
        const payload = parsePayload(commentPayloadSchema, write.payload_json);
        return this.publishComment(write.issue_id, {
          client_id: write.idempotency_key,
          body: payload.body,
          parent_id: payload.parent_id,
          run_id: runId,
        });
      }
      case "pr_link": {
        const payload = parsePayload(prLinkPayloadSchema, write.payload_json);
        return this.publishPrLink(write.issue_id, {
          url: payload.url,
          title: payload.title,
          run_id: runId,
        });
      }
      case "fields":
        return this.publishFields(write.issue_id, { overwrite: false });
    }
  }

  private async runWrite(
    write: LinearWriteRow,
    operation: (apiKey: string, signal: AbortSignal) => Promise<WriteOutcome>,
  ): Promise<void> {
    this.active.add(write.id);
    try {
      const { apiKey, signal } = this.config.authorize();
      const sending = this.transition(write, "sending");
      const outcome = await this.config.guard(signal, () => operation(apiKey, signal));
      const sent = this.markSent(sending, outcome);
      this.emitEvent(sent);
    } catch (error) {
      this.fail(this.reload(write.id), error);
      throw error;
    } finally {
      this.active.delete(write.id);
    }
  }

  private ensurePending(existing: LinearWriteRow | undefined, spec: PendingSpec): LinearWriteRow {
    if (existing) {
      updateLinearWrite(this.config.db, existing.id, {
        run_id: spec.runId,
        payload_json: spec.payload,
        detail: spec.detail,
        error_code: null,
        error_message: null,
      });
      return this.reload(existing.id);
    }
    const id = this.config.idFactory();
    insertLinearWrite(this.config.db, {
      id,
      issue_id: spec.issueId,
      run_id: spec.runId,
      kind: spec.kind,
      idempotency_key: spec.key,
      payload_json: spec.payload,
      detail: spec.detail,
    });
    return this.reload(id);
  }

  private transition(
    row: LinearWriteRow,
    status: LinearWriteState,
    patch: Parameters<typeof updateLinearWrite>[2] = {},
  ): LinearWriteRow {
    if (row.status !== status) linearWriteMachine.transition(row.status, status);
    updateLinearWrite(this.config.db, row.id, { ...patch, status });
    return this.reload(row.id);
  }

  private markSent(row: LinearWriteRow, outcome: WriteOutcome): LinearWriteRow {
    return this.transition(row, "sent", {
      remote_id: outcome.remote_id,
      detail: outcome.detail,
      error_code: null,
      error_message: null,
    });
  }

  private fail(row: LinearWriteRow, error: unknown): LinearWriteRow {
    if (row.status === "sent") return row;
    const failure = safeLinearFailure(error);
    return this.transition(row, "failed", {
      error_code: failure.code,
      error_message: failure.message,
    });
  }

  private recover(row: LinearWriteRow): LinearWriteRow {
    if ((row.status !== "pending" && row.status !== "sending") || this.active.has(row.id)) {
      return row;
    }
    return this.transition(row, "failed", {
      error_code: "linear_write_interrupted",
      error_message: "The write was interrupted before Linear confirmed it. Retry to reconcile it.",
    });
  }

  private emitEvent(row: LinearWriteRow): void {
    if (row.run_id === null) return;
    const type = linearWriteEventType(row.kind);
    if (type === null) return;
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      row.run_id,
      buildLinearWriteEvent(row.run_id, type, row, this.config.now().toISOString()),
    );
  }

  private refreshMirror(issue: IssueRow, detail: LinearIssueDetail): void {
    upsertMirroredIssue(this.config.db, {
      id: issue.id,
      project_id: issue.project_id,
      source: "linear",
      source_external_id: detail.external_id,
      source_identifier: detail.identifier,
      source_url: detail.url,
      title: detail.title,
      body: detail.description,
      status: issueStateFromLinear(detail.state.type),
      synced_at: this.config.now().toISOString(),
      source_updated_at: detail.updated_at,
      source_assignee_name: detail.assignee?.name ?? null,
      source_priority: detail.priority,
      source_labels: detail.labels.map((label) => ({ name: label.name, color: label.color })),
      source_state_name: detail.state.name,
      source_state_color: detail.state.color,
    });
  }

  private state(issueId: string): LinearWritebackState {
    const draft = getLinearDraft(this.config.db, issueId);
    const writes = listLinearWritesForIssue(this.config.db, issueId).map((row) =>
      this.toWriteContract(this.recover(row)),
    );
    return { draft: draft ? this.toDraftContract(draft) : null, writes };
  }

  private requireWritableIssue(issueId: string): WritableIssue {
    const issue = getIssue(this.config.db, issueId);
    if (!issue) throw linearError("linear_issue_not_found");
    if (issue.source !== "linear" || !issue.source_external_id) {
      throw linearError("linear_issue_not_writable");
    }
    return { issue, linearId: issue.source_external_id };
  }

  private reload(id: string): LinearWriteRow {
    const row = getLinearWrite(this.config.db, id);
    if (!row) throw new Error(`linear write ${id} vanished`);
    return row;
  }

  private toDraftContract(row: LinearDraftRow): LinearIssueDraft {
    return {
      id: row.id,
      issue_id: row.issue_id,
      base_updated_at: row.base_updated_at,
      title: row.title,
      description: row.description,
      priority: row.priority,
      assignee_id: row.assignee_id,
      label_ids: row.label_ids,
      updated_at: sqliteToIso(row.updated_at),
    };
  }

  private toWriteContract(row: LinearWriteRow): LinearWriteContract {
    return {
      id: row.id,
      issue_id: row.issue_id,
      run_id: row.run_id,
      kind: row.kind,
      status: row.status,
      idempotency_key: row.idempotency_key,
      detail: row.detail,
      remote_id: row.remote_id,
      error_code: row.error_code,
      error_message: row.error_message,
      created_at: sqliteToIso(row.created_at),
      updated_at: sqliteToIso(row.updated_at),
    };
  }
}

function draftMatchesPayload(draft: LinearDraftRow, payload: unknown): boolean {
  const parsed = fieldsPayloadSchema.safeParse(payload);
  if (!parsed.success) return false;
  return (
    parsed.data.title === draft.title &&
    (parsed.data.description ?? null) === (draft.description ?? null) &&
    parsed.data.priority === draft.priority &&
    (parsed.data.assignee_id ?? null) === (draft.assignee_id ?? null) &&
    labelsEqual(parsed.data.label_ids, draft.label_ids)
  );
}

function fieldsPayload(draft: LinearDraftRow): Record<string, unknown> {
  return {
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    assignee_id: draft.assignee_id,
    label_ids: draft.label_ids,
  };
}

function commentDetail(body: string): string {
  const firstLine = body.trim().split("\n", 1)[0] ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("linear write payload is corrupted");
  return parsed.data;
}

export function createLinearWriteback(config: LinearWritebackConfig): LinearWriteback {
  return new DefaultLinearWriteback(config);
}
