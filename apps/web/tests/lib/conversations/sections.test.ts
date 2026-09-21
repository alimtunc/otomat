import { groupConversations } from "@web/lib/conversations/sections";
import { expect, it } from "vitest";

import { conversationEntry } from "#support/conversations";

it("keeps an unread finished thread with the active ones and hides an empty section", () => {
  const sections = groupConversations([
    conversationEntry(),
    conversationEntry({
      id: "conversation:step-2",
      step_run_id: "step-2",
      step_status: "succeeded",
    }),
    conversationEntry({
      id: "conversation:step-3",
      step_run_id: "step-3",
      step_status: "succeeded",
      read: true,
    }),
  ]);

  expect(
    sections.map((section) => [section.label, section.entries.map((entry) => entry.step_run_id)]),
  ).toEqual([
    ["Active", ["step-1", "step-2"]],
    ["Recently finished", ["step-3"]],
  ]);
  expect(groupConversations([conversationEntry()]).map((section) => section.key)).toEqual([
    "active",
  ]);
});
