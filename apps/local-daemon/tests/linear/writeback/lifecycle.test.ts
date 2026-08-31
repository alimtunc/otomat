import { getIssue, listLinearWritesForIssue } from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { seedRepository } from "#test-support/db";
import { CONNECTION, linearDetail, setupLinearWritebackTest } from "#test-support/linear-writeback";
import { seedRun } from "#test-support/seed";

let test: ReturnType<typeof setupLinearWritebackTest>;

const DOING = { in_progress_state_id: "s-doing", in_progress_state_name: "Doing" };
const SHIPPED = { done_state_id: "s-shipped", done_state_name: "Shipped" };

const STARTED = { id: "s-doing", name: "Doing", type: "started", color: "#facc15" };
const COMPLETED = { id: "s-shipped", name: "Shipped", type: "completed", color: "#0a0" };

beforeEach(() => {
  test = setupLinearWritebackTest();
  test.seedLinearIssue();
  test.seedRun();
});

afterEach(() => test.cleanup());

it("moves the issue into the team's own started state when a run is created", async () => {
  test.seedSource(DOING);
  const updateIssue = vi.fn(async () => linearDetail({ state: STARTED }));
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue,
  });

  await service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });

  expect(updateIssue).toHaveBeenCalledWith(
    expect.any(String),
    "L-1",
    { stateId: "s-doing" },
    expect.anything(),
  );
  const state = service.writeback.writebackState("li");
  expect(state.lifecycle).toMatchObject({
    phase: "in_progress",
    target_state_id: "s-doing",
    target_state_name: "Doing",
    status: "sent",
    detail: "In Progress → Doing",
  });
  expect(test.readLedger("r1")).toContain("linear.lifecycle_synced");
  expect(getIssue(test.db, "li")?.source_state_name).toBe("Doing");
});

it("closes the issue into the configured done state and reports it to the cockpit", async () => {
  test.seedSource({ ...DOING, ...SHIPPED });
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail({ state: STARTED }),
    updateIssue: async () => linearDetail({ state: COMPLETED }),
  });

  await service.syncIssueLifecycle({ issue_id: "li", phase: "done", run_id: "r1" });

  expect(service.writeback.writebackState("li").lifecycle).toMatchObject({
    phase: "done",
    target_state_name: "Shipped",
    status: "sent",
  });
  expect(getIssue(test.db, "li")?.status).toBe("done");
});

it("writes nothing at all when the team has no mapping for the phase", async () => {
  test.seedSource(DOING);
  const updateIssue = vi.fn();
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue,
  });

  await service.syncIssueLifecycle({ issue_id: "li", phase: "done", run_id: "r1" });

  expect(updateIssue).not.toHaveBeenCalled();
  expect(listLinearWritesForIssue(test.db, "li")).toHaveLength(0);
  expect(service.writeback.writebackState("li").lifecycle).toBeNull();
});

it("writes nothing while the integration has no write right", async () => {
  test.seedSource(DOING);
  const issueSnapshot = vi.fn(async () => linearDetail());
  const service = await test.connectedService({ issueSnapshot });
  service.disconnect(CONNECTION.id);

  await service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });

  expect(issueSnapshot).not.toHaveBeenCalled();
  expect(listLinearWritesForIssue(test.db, "li")).toHaveLength(0);
});

it("skips the mutation but confirms the sync when the issue already holds the state", async () => {
  test.seedSource(DOING);
  const updateIssue = vi.fn();
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail({ state: STARTED }),
    updateIssue,
  });

  await service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });

  expect(updateIssue).not.toHaveBeenCalled();
  expect(service.writeback.writebackState("li").lifecycle?.status).toBe("sent");
});

it("reopens an issue closed in Linear when another step is added to unmerged work", async () => {
  test.seedSource({ ...DOING, ...SHIPPED });
  let remote = linearDetail({ state: STARTED });
  const updateIssue = vi.fn(async () => {
    remote = linearDetail({ state: STARTED });
    return remote;
  });
  const service = await test.connectedService({
    issueSnapshot: async () => remote,
    updateIssue,
  });

  await service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });
  expect(updateIssue).not.toHaveBeenCalled();

  remote = linearDetail({ state: COMPLETED });
  await service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });

  expect(updateIssue).toHaveBeenCalledOnce();
  const writes = listLinearWritesForIssue(test.db, "li");
  expect(writes).toHaveLength(2);
  expect(writes.every((write) => write.status === "sent")).toBe(true);
});

it("lands overlapping assertions for one issue in signal order, so done stays final", async () => {
  test.seedSource({ ...DOING, ...SHIPPED });
  let remote = linearDetail();
  const stateUpdates: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const updateIssue = vi.fn(async (_key: string, _id: string, input: { stateId?: string }) => {
    if (stateUpdates.length === 0) await firstGate;
    stateUpdates.push(input.stateId ?? "");
    remote = linearDetail({ state: input.stateId === "s-doing" ? STARTED : COMPLETED });
    return remote;
  });
  const service = await test.connectedService({
    issueSnapshot: async () => remote,
    updateIssue,
  });

  const first = service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" });
  const second = service.syncIssueLifecycle({ issue_id: "li", phase: "done", run_id: "r1" });
  releaseFirst();
  await Promise.all([first, second]);

  expect(stateUpdates).toEqual(["s-doing", "s-shipped"]);
  expect(getIssue(test.db, "li")?.status).toBe("done");
  expect(getIssue(test.db, "li")?.source_state_name).toBe("Shipped");
});

it("keeps asserting after an earlier failed assertion for the same issue", async () => {
  test.seedSource({ ...DOING, ...SHIPPED });
  let failFirst = true;
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue: async () => {
      if (failFirst) {
        failFirst = false;
        throw new Error("boom");
      }
      return linearDetail({ state: COMPLETED });
    },
  });

  await expect(
    service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" }),
  ).rejects.toThrow();
  await service.syncIssueLifecycle({ issue_id: "li", phase: "done", run_id: "r1" });

  expect(getIssue(test.db, "li")?.status).toBe("done");
});

it("catches a confirmed mapping up with the issues still holding a workspace", async () => {
  seedRepository(test.db);
  seedRun(test.db, {
    runId: "r2",
    issueId: "li",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  test.seedSource(DOING);
  const updateIssue = vi.fn(async () => linearDetail({ state: STARTED }));
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue,
  });

  expect(await service.reconcileSource("src-1")).toEqual({ reconciled: 1, failed: 0 });
  expect(updateIssue).toHaveBeenCalledWith(
    expect.any(String),
    "L-1",
    { stateId: "s-doing" },
    expect.anything(),
  );
  expect(service.writeback.writebackState("li").lifecycle).toMatchObject({
    phase: "in_progress",
    target_state_name: "Doing",
    status: "sent",
  });
});

it("keeps a refused write visible and retryable without claiming success", async () => {
  test.seedSource(DOING);
  let authorized = false;
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue: async () => {
      if (!authorized) throw new Error("boom");
      return linearDetail({ state: STARTED });
    },
  });

  await expect(
    service.syncIssueLifecycle({ issue_id: "li", phase: "in_progress", run_id: "r1" }),
  ).rejects.toThrow();
  const failed = service.writeback.writebackState("li").lifecycle;
  expect(failed).toMatchObject({
    status: "failed",
    error_code: "linear_request_failed",
    target_state_name: "Doing",
  });
  expect(failed?.error_message).toBe("Linear returned an unexpected response.");

  authorized = true;
  const retried = await service.writeback.retryWrite(failed?.write_id ?? "");

  expect(retried.lifecycle).toMatchObject({ status: "sent", phase: "in_progress" });
  expect(listLinearWritesForIssue(test.db, "li")).toHaveLength(1);
});
