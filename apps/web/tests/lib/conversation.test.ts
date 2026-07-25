import type { RunContributionContract } from "@otomat/domain";
import {
  buildConversation,
  describeActivity,
  isRetriable,
  queuedCount,
} from "@web/lib/conversation";
import { expect, it } from "vitest";

import { envelope } from "#support/envelope";

function contribution(overrides: Partial<RunContributionContract> = {}): RunContributionContract {
  return {
    id: "c1",
    run_id: "run-1",
    seq: 0,
    body: "keep going",
    status: "queued",
    agent_session_id: null,
    delivered_at: null,
    settled_at: null,
    attempts: 0,
    error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function anchor(seq: number, contributionId: string) {
  return envelope({ seq, type: "run.contribution", payload: { contribution_id: contributionId } });
}

function agentSaid(seq: number, text: string) {
  return envelope({ seq, type: "runtime.message", payload: { role: "assistant", text } });
}

it("places each message where the ledger anchored it, around the agent's replies", () => {
  const first = contribution({ id: "c1", seq: 0 });
  const second = contribution({ id: "c2", seq: 1, body: "and this too" });
  const items = buildConversation(
    [anchor(0, "c1"), agentSaid(1, "on it"), anchor(2, "c2"), agentSaid(3, "done")],
    [first, second],
  );

  expect(items.map((item) => item.key)).toEqual(["message-c1", "agent-1", "message-c2", "agent-3"]);
});

it("folds tools, logs and permission round-trips into one collapsed group per run of them", () => {
  const items = buildConversation(
    [
      envelope({ seq: 0, type: "runtime.log", payload: { text: "starting" } }),
      envelope({ seq: 1, type: "runtime.tool_call", payload: { tool: "read_file" } }),
      envelope({ seq: 2, type: "runtime.permission_request", payload: { action: "write_file" } }),
      agentSaid(3, "here is what I changed"),
      envelope({ seq: 4, type: "runtime.usage", payload: {} }),
    ],
    [],
  );

  expect(items.map((item) => item.kind)).toEqual(["activity", "agent", "activity"]);
  const [group] = items;
  if (group?.kind !== "activity") throw new Error("expected a leading activity group");
  expect(group.events.map((event) => event.seq)).toEqual([0, 1, 2]);
  expect(group.counts).toMatchObject({ tools: 1, permissions: 1, logs: 1 });
});

it("keeps reasoning out of the conversation but counts it in the group", () => {
  const items = buildConversation(
    [
      envelope({
        seq: 0,
        type: "runtime.message",
        payload: { role: "assistant", text: "let me think", thinking: true },
      }),
      agentSaid(1, "the answer"),
    ],
    [],
  );

  expect(items.map((item) => item.kind)).toEqual(["activity", "agent"]);
  const [group] = items;
  if (group?.kind !== "activity") throw new Error("expected reasoning to be grouped");
  expect(group.counts.thinking).toBe(1);
});

it("keeps milestones readable instead of burying them in a group", () => {
  const items = buildConversation(
    [
      envelope({ seq: 0, type: "runtime.log", payload: { text: "working" } }),
      envelope({ seq: 1, type: "git.diff_updated", payload: {} }),
      envelope({ seq: 2, type: "run.lifecycle", payload: { final_status: "completed" } }),
    ],
    [],
  );

  expect(items.map((item) => item.kind)).toEqual(["activity", "milestone", "milestone"]);
});

it("opens a section per step on a multi-step run, keeping run-level events under the open one", () => {
  const steps = [
    { id: "s1", name: "Scaffold" },
    { id: "s2", name: "Test" },
  ];
  const items = buildConversation(
    [
      envelope({ seq: 0, type: "runtime.log", step_run_id: "s1", payload: { text: "a" } }),
      envelope({ seq: 1, type: "run.lifecycle", step_run_id: null, payload: {} }),
      envelope({ seq: 2, type: "runtime.log", step_run_id: "s2", payload: { text: "b" } }),
    ],
    [],
    steps,
  );

  expect(items.map((item) => item.kind)).toEqual([
    "step",
    "activity",
    "milestone",
    "step",
    "activity",
  ]);
  expect(items.filter((item) => item.kind === "step").map((item) => item.name)).toEqual([
    "Scaffold",
    "Test",
  ]);
});

it("leaves a single-step run without section headers", () => {
  const items = buildConversation(
    [envelope({ seq: 0, type: "runtime.log", step_run_id: "s1", payload: { text: "a" } })],
    [],
    [{ id: "s1", name: "Agent turn" }],
  );
  expect(items.map((item) => item.kind)).toEqual(["activity"]);
});

it("ignores an empty agent message rather than rendering a blank bubble", () => {
  const items = buildConversation([agentSaid(0, "   ")], []);
  expect(items.map((item) => item.kind)).toEqual(["activity"]);
});

it("renders a message once even though the ledger records each of its lifecycle steps", () => {
  const items = buildConversation([anchor(0, "c1"), anchor(1, "c1")], [contribution({ id: "c1" })]);
  expect(items.filter((item) => item.kind === "message")).toHaveLength(1);
});

it("keeps a message the stream has not carried yet, in send order at the end", () => {
  const items = buildConversation(
    [anchor(0, "c2")],
    [contribution({ id: "c2", seq: 0 }), contribution({ id: "c3", seq: 1, body: "just sent" })],
  );
  expect(items.map((item) => item.key)).toEqual(["message-c2", "message-c3"]);
});

it("drops an anchor whose contribution the read model does not know", () => {
  expect(buildConversation([anchor(0, "gone")], [])).toEqual([]);
});

it("says exactly how much a group folds", () => {
  expect(describeActivity({ tools: 2, permissions: 2, thinking: 0, logs: 3, other: 0 }, 7)).toBe(
    "7 steps · 2 tools · 2 permissions · 3 logs",
  );
  expect(describeActivity({ tools: 2, permissions: 1, thinking: 0, logs: 3, other: 0 }, 6)).toBe(
    "6 steps · 2 tools · 1 permission · 3 logs",
  );
  expect(describeActivity({ tools: 1, permissions: 0, thinking: 0, logs: 0, other: 0 }, 1)).toBe(
    "1 step · 1 tool",
  );
});

it("offers a retry only for a failure that never reached the provider", () => {
  expect(isRetriable(contribution({ status: "failed" }))).toBe(true);
  expect(
    isRetriable(contribution({ status: "failed", delivered_at: "2026-01-01T00:00:01.000Z" })),
  ).toBe(false);
  expect(isRetriable(contribution({ status: "sent" }))).toBe(false);
});

it("counts only the messages still waiting", () => {
  expect(
    queuedCount([
      contribution({ id: "a", status: "queued" }),
      contribution({ id: "b", status: "sent" }),
      contribution({ id: "c", status: "queued" }),
    ]),
  ).toBe(2);
});
