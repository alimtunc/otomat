import { conversationStatus } from "@web/lib/conversations/status";
import { expect, it } from "vitest";

import { conversationEntry, terminalConversationEntry } from "#support/conversations";

it("keeps attention visible when a collapsed issue also has running and completed threads", () => {
  const entries = [
    conversationEntry(),
    conversationEntry({ step_status: "succeeded" }),
    conversationEntry({ step_status: "failed" }),
  ];

  expect(conversationStatus(entries)).toBe("failed");
  expect(
    conversationStatus([
      ...entries,
      conversationEntry({
        step_status: "running",
        pending_interaction: { kind: "text", prompt: "Which option?" },
      }),
    ]),
  ).toBe("awaiting_human");
});

it("omits settled states while retaining running and provider wait labels", () => {
  expect(conversationStatus([])).toBeNull();
  expect(
    conversationStatus([
      conversationEntry({ step_status: "succeeded" }),
      conversationEntry({ step_status: "canceled" }),
      conversationEntry({ step_status: "withdrawn" }),
    ]),
  ).toBeNull();
  expect(conversationStatus([conversationEntry()])).toBe("running");
  expect(conversationStatus([conversationEntry({ step_status: "waiting_for_provider" })])).toBe(
    "waiting_for_provider",
  );
});

it("does not treat terminal state as a cockpit step state", () => {
  const entry = terminalConversationEntry();
  const terminal = { ...entry, terminal: { ...entry.terminal, state: "running" as const } };
  expect(conversationStatus([terminal])).toBeNull();
  expect(conversationStatus([terminal, conversationEntry({ step_status: "failed" })])).toBe(
    "failed",
  );
});
