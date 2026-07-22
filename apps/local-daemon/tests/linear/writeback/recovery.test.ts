import { insertLinearWrite, schema, updateLinearWrite, listLinearWritesForIssue } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createLinearApiClient, type LinearTransport } from "#linear";
import { API_KEY, COMMENT_UUID, setupLinearWritebackTest } from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

const rateLimitedTransport: LinearTransport = async ({ query }) => {
  if (query.includes("OtomatViewer")) {
    return {
      status: 200,
      body: {
        data: { viewer: { name: "Alim" }, organization: { id: "w1", name: "Otomat" } },
      },
    };
  }
  return { status: 400, body: { errors: [{ extensions: { code: "RATELIMITED" } }] } };
};

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("recovers a write interrupted by a crash into a retryable failure", async () => {
  test.seedLinearIssue();
  insertLinearWrite(test.db, {
    id: "w-int",
    issue_id: "li",
    run_id: null,
    kind: "status",
    idempotency_key: "s-x",
    payload_json: { state_id: "s-x" },
    detail: null,
  });
  updateLinearWrite(test.db, "w-int", { status: "sending" });

  const service = await test.connectedService();
  expect(service.writeback.writebackState("li").writes[0]).toMatchObject({
    status: "failed",
    error_code: "linear_write_interrupted",
  });
});

it("persists an offline publish attempt as a retryable failure", async () => {
  test.seedLinearIssue();
  const service = await test.connectedService();
  service.disconnect();

  await expect(service.writeback.publishStatus("li", { state_id: "s-done" })).rejects.toThrow();
  expect(service.writeback.writebackState("li").writes[0]).toMatchObject({
    kind: "status",
    status: "failed",
    error_code: "linear_not_connected",
  });
});

it("classifies a rate-limited GraphQL body even under HTTP 400 and persists it", async () => {
  test.seedLinearIssue();
  const service = test.createService(createLinearApiClient(rateLimitedTransport));
  await service.connect(API_KEY);

  await expect(service.writeback.publishStatus("li", { state_id: "s-done" })).rejects.toThrow();
  expect(service.writeback.writebackState("li").writes[0].error_code).toBe("linear_rate_limited");
});

it("never persists the API key in rows or the ledger", async () => {
  test.seedLinearIssue();
  test.seedRun();
  const service = await test.connectedService({
    listComments: async () => [],
    createComment: async () => "cmt-1",
  });

  await service.writeback.publishComment("li", {
    client_id: COMMENT_UUID,
    body: "Landed the fix",
    run_id: "r1",
  });

  const dump = JSON.stringify([
    listLinearWritesForIssue(test.db, "li"),
    test.db.select().from(schema.linearIssueDrafts).all(),
    test.db.select().from(schema.runtimeEvents).all(),
    test.readLedger("r1"),
  ]);
  expect(dump).not.toContain(API_KEY);
});
