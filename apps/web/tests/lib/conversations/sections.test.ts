import { groupConversations } from "@web/lib/conversations/sections";
import { expect, it } from "vitest";

import { conversationEntry } from "#support/conversations";

const finished = (step: string, issueId: string) =>
  conversationEntry({
    id: `conversation:${step}`,
    step_run_id: step,
    step_status: "succeeded",
    issue: { id: issueId, identifier: null, title: issueId, cycle: null },
  });

it("sections by the issue's cycle, one group per issue, and hides an empty section", () => {
  const sections = groupConversations([
    conversationEntry(),
    conversationEntry({
      id: "conversation:step-2",
      step_run_id: "step-2",
      step_status: "succeeded",
      read: true,
    }),
    finished("step-3", "issue-2"),
    conversationEntry({
      id: "conversation:step-4",
      step_run_id: "step-4",
      issue: { id: "issue-3", identifier: "OTO-3", title: "Review it", cycle: "reviewing" },
    }),
  ]);

  expect(
    sections.map((section) => [
      section.label,
      section.groups.map((group) => [
        group.issue.id,
        group.entries.map((entry) => entry.step_run_id),
      ]),
    ]),
  ).toEqual([
    [
      "Following",
      [
        ["issue-1", ["step-1", "step-2"]],
        ["issue-3", ["step-4"]],
      ],
    ],
    ["Recently finished", [["issue-2", ["step-3"]]]],
  ]);
  expect(groupConversations([conversationEntry()]).map((section) => section.key)).toEqual([
    "active",
  ]);
});

it("keeps an unread finished thread out of Active and caps the finished issues", () => {
  const entries = Array.from({ length: 12 }, (_, index) =>
    finished(`step-${index}`, `issue-${index}`),
  );

  const [section] = groupConversations(entries);

  expect(section?.key).toBe("finished");
  expect(section?.groups).toHaveLength(10);
  expect(section?.groups[0]?.entries[0]?.read).toBe(false);
});
