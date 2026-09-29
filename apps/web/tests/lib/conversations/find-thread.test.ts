import { findConversationThread } from "@web/lib/conversations/find-thread";
import { expect, it } from "vitest";

import { conversationEntry, terminalConversationEntry } from "#support/conversations";

const step = conversationEntry();
const terminal = terminalConversationEntry();
const entries = [step, terminal];

it("finds a step thread by its step and a terminal by its session, never one for the other", () => {
  expect(findConversationThread(entries, { step: step.step_run_id })).toBe(step);
  expect(findConversationThread(entries, { terminal: terminal.terminal.id })).toBe(terminal);
  expect(findConversationThread(entries, { step: terminal.terminal.id })).toBeUndefined();
  expect(findConversationThread(entries, { terminal: step.step_run_id })).toBeUndefined();
});
