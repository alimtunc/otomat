import { expect, it } from "vitest";

import { issueContractSchema, issueSourceContractSchema } from "#domain/contracts/entities";
import {
  connectLinearRequestSchema,
  createIssueSourceRequestSchema,
  linearConnectionContractSchema,
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
