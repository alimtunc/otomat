import { expect, it } from "vitest";

import { issueContractSchema, issueSourceContractSchema } from "#domain/contracts/entities/issues";
import {
  connectLinearRequestSchema,
  createIssueSourceRequestSchema,
  linearConnectionContractSchema,
  linearEditableFieldsSchema,
  linearIssueDraftSchema,
  linearWriteConflictSchema,
  linearWriteContractSchema,
  publishCommentRequestSchema,
  publishFieldsRequestSchema,
  saveLinearDraftRequestSchema,
} from "#domain/contracts/linear";

it("carries honest connection state without credentials", () => {
  const connection = linearConnectionContractSchema.parse({
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  });

  expect(Object.keys(connection)).not.toContain("api_key");
  expect(JSON.stringify(connection)).not.toContain("lin_api");
});

it("strips a key smuggled into the connection contract", () => {
  const connection = linearConnectionContractSchema.parse({
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
    api_key: "lin_api_secret",
  });

  expect(JSON.stringify(connection)).not.toContain("lin_api_secret");
});

it("accepts only the key on the connect request", () => {
  expect(connectLinearRequestSchema.parse({ api_key: "lin_api_secret" })).toEqual({
    api_key: "lin_api_secret",
  });
  expect(connectLinearRequestSchema.safeParse({ api_key: "" }).success).toBe(false);
  expect(connectLinearRequestSchema.safeParse({ api_key: "k", persist: true }).success).toBe(false);
});

it("ties connection payloads to their status", () => {
  expect(
    linearConnectionContractSchema.safeParse({
      status: "connected",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: null,
      error_message: null,
    }).success,
  ).toBe(false);
  expect(
    linearConnectionContractSchema.safeParse({
      status: "failed",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: "unknown",
      error_message: "Nope",
    }).success,
  ).toBe(false);
});

it("accepts only provider IDs and keeps labels server-owned", () => {
  const team = {
    project_id: "local-1",
    external_team_id: "team-1",
  };
  expect(createIssueSourceRequestSchema.safeParse(team).success).toBe(true);
  expect(
    createIssueSourceRequestSchema.safeParse({
      ...team,
      external_project_id: "project-1",
    }).success,
  ).toBe(true);
  expect(
    createIssueSourceRequestSchema.safeParse({ ...team, external_team_name: "Forged" }).success,
  ).toBe(false);
});

it("ties persisted project labels to their project ids", () => {
  const source = {
    id: "source-1",
    project_id: "local-1",
    source: "linear",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    last_synced_at: null,
  };

  expect(
    issueSourceContractSchema.safeParse({
      ...source,
      external_project_id: "",
      external_project_name: "",
    }).success,
  ).toBe(true);
  expect(
    issueSourceContractSchema.safeParse({
      ...source,
      external_project_id: "project-1",
      external_project_name: "",
    }).success,
  ).toBe(false);
});

it("separates the immutable external identity from the human identifier", () => {
  const issue = issueContractSchema.parse({
    id: "local-1",
    project_id: "p1",
    title: "Mirrored",
    body: null,
    status: "ready",
    source: "linear",
    source_external_id: "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    source_identifier: "OTO-36",
    source_url: "https://linear.app/otomat/issue/OTO-36",
    synced_at: "2026-07-20T10:00:00.000Z",
    source_assignee_name: "Alim",
    source_priority: 2,
    source_labels: [{ name: "Front", color: "#facc15" }],
    source_state_name: "In Progress",
    source_state_color: "#facc15",
  });

  expect(issue.source_external_id).not.toBe(issue.source_identifier);
  expect(issue.source_identifier).toBe("OTO-36");
});

it("accepts a missing URL on mirrors migrated from the legacy schema", () => {
  expect(
    issueContractSchema.safeParse({
      id: "local-1",
      project_id: "p1",
      title: "Legacy mirror",
      body: null,
      status: "ready",
      source: "linear",
      source_external_id: "OTO-36",
      source_identifier: "OTO-36",
      source_url: null,
      synced_at: "2026-07-20T10:00:00.000Z",
      source_assignee_name: null,
      source_priority: null,
      source_labels: null,
      source_state_name: null,
      source_state_color: null,
    }).success,
  ).toBe(true);
});

it("ties mirror metadata to the issue source", () => {
  const base = {
    id: "local-1",
    project_id: "p1",
    title: "Issue",
    body: null,
    status: "ready",
  };

  expect(
    issueContractSchema.safeParse({
      ...base,
      source: "local",
      source_external_id: "linear-uuid",
      source_identifier: null,
      source_url: null,
      synced_at: null,
    }).success,
  ).toBe(false);
  expect(
    issueContractSchema.safeParse({
      ...base,
      source: "linear",
      source_external_id: null,
      source_identifier: null,
      source_url: null,
      synced_at: null,
    }).success,
  ).toBe(false);
});

const editableFields = {
  title: "Wire write-back",
  description: "Body",
  priority: 2,
  assignee_id: "user-1",
  label_ids: ["label-1", "label-2"],
};

it("bounds editable fields and keeps assignee optional", () => {
  expect(linearEditableFieldsSchema.safeParse(editableFields).success).toBe(true);
  expect(
    linearEditableFieldsSchema.safeParse({ ...editableFields, assignee_id: null, label_ids: [] })
      .success,
  ).toBe(true);
  expect(linearEditableFieldsSchema.safeParse({ ...editableFields, priority: 5 }).success).toBe(
    false,
  );
  expect(linearEditableFieldsSchema.safeParse({ ...editableFields, title: "   " }).success).toBe(
    false,
  );
});

it("keeps the draft free of smuggled credentials", () => {
  const draft = linearIssueDraftSchema.parse({
    ...editableFields,
    id: "draft-1",
    issue_id: "issue-1",
    base_updated_at: "2026-07-21T10:00:00.000Z",
    updated_at: "2026-07-21T10:05:00.000Z",
    api_key: "lin_api_secret",
  });
  expect(JSON.stringify(draft)).not.toContain("lin_api_secret");
});

it("keeps the audit write row free of smuggled credentials or payload", () => {
  const write = linearWriteContractSchema.parse({
    id: "write-1",
    issue_id: "issue-1",
    run_id: null,
    kind: "comment",
    status: "sent",
    idempotency_key: "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    detail: "Ran the agent",
    remote_id: "comment-1",
    error_code: null,
    error_message: null,
    created_at: "2026-07-21T10:00:00.000Z",
    updated_at: "2026-07-21T10:00:01.000Z",
    api_key: "lin_api_secret",
    payload_json: "{}",
  });
  expect(JSON.stringify(write)).not.toContain("lin_api_secret");
  expect(JSON.stringify(write)).not.toContain("payload_json");
});

it("defaults a fields publish to safe and rejects unknown keys", () => {
  expect(publishFieldsRequestSchema.parse({})).toEqual({ overwrite: false });
  expect(publishFieldsRequestSchema.safeParse({ overwrite: true }).success).toBe(true);
  expect(publishFieldsRequestSchema.safeParse({ force: true }).success).toBe(false);
});

it("requires a persisted client id for idempotent comments", () => {
  expect(
    publishCommentRequestSchema.safeParse({
      client_id: "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      body: "done",
    }).success,
  ).toBe(true);
  expect(publishCommentRequestSchema.safeParse({ client_id: "nope", body: "done" }).success).toBe(
    false,
  );
  expect(
    publishCommentRequestSchema.safeParse({
      client_id: "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      body: "  ",
    }).success,
  ).toBe(false);
});

it("carries remote values on a write conflict for explicit resolution", () => {
  const conflict = linearWriteConflictSchema.parse({
    error: "linear_write_conflict",
    message: "The remote issue changed.",
    remote: {
      ...editableFields,
      external_id: "issue-uuid",
      identifier: "OTO-37",
      url: "https://linear.app/otomat/issue/OTO-37",
      updated_at: "2026-07-21T12:00:00.000Z",
      assignee: { id: "user-1", name: "Alim" },
      labels: [{ id: "label-1", name: "Bug", color: "#f00" }],
      state: { id: "state-1", name: "In Progress", type: "started", color: "#00f" },
    },
  });
  expect(conflict.remote.updated_at).toBe("2026-07-21T12:00:00.000Z");
});

it("requires an explicit base revision when saving a draft", () => {
  expect(
    saveLinearDraftRequestSchema.safeParse({
      ...editableFields,
      base_updated_at: "2026-07-21T10:00:00.000Z",
    }).success,
  ).toBe(true);
  expect(saveLinearDraftRequestSchema.safeParse(editableFields).success).toBe(false);
});
