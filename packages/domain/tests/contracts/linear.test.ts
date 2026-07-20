import { expect, it } from "vitest";

import { connectLinearRequestSchema, linearConnectionContractSchema } from "#domain/contracts/api";
import { issueContractSchema } from "#domain/contracts/entities";

it("carries honest connection state without credentials", () => {
  const connection = linearConnectionContractSchema.parse({
    status: "connected",
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
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
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
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
