import {
  activeConversationFilterCount,
  applyConversationFilters,
  conversationProjectOptions,
  NO_CONVERSATION_FILTERS,
} from "@web/lib/conversations/filters";
import { describe, expect, it } from "vitest";

import { conversationEntry } from "#support/conversations";

const entries = [
  conversationEntry(),
  conversationEntry({ id: "conversation:step-2", step_run_id: "step-2", read: true }),
  conversationEntry({
    id: "conversation:step-3",
    step_run_id: "step-3",
    step_status: "awaiting_permission",
    pending_interaction: { kind: "permission", prompt: "Run pnpm check?" },
  }),
  conversationEntry({
    id: "conversation:step-4",
    step_run_id: "step-4",
    step_status: "succeeded",
    project: { id: "p2", name: "Docs" },
  }),
  conversationEntry({ id: "conversation:step-5", step_run_id: "step-5", archived: true }),
];

const ids = (filtered: { step_run_id: string }[]) => filtered.map((entry) => entry.step_run_id);

describe("applyConversationFilters", () => {
  it("hides archived threads whatever the filter says", () => {
    expect(ids(applyConversationFilters(entries, NO_CONVERSATION_FILTERS))).toEqual([
      "step-1",
      "step-2",
      "step-3",
      "step-4",
    ]);
  });

  it("narrows by state, unread and project", () => {
    expect(
      ids(applyConversationFilters(entries, { ...NO_CONVERSATION_FILTERS, state: "waiting" })),
    ).toEqual(["step-3"]);
    expect(
      ids(applyConversationFilters(entries, { ...NO_CONVERSATION_FILTERS, state: "finished" })),
    ).toEqual(["step-4"]);
    expect(
      ids(applyConversationFilters(entries, { ...NO_CONVERSATION_FILTERS, unread: true })),
    ).toEqual(["step-1", "step-3", "step-4"]);
    expect(
      ids(applyConversationFilters(entries, { ...NO_CONVERSATION_FILTERS, projects: ["p2"] })),
    ).toEqual(["step-4"]);
  });

  it("counts the filters that narrow the list and lists the projects present", () => {
    expect(activeConversationFilterCount(NO_CONVERSATION_FILTERS)).toBe(0);
    expect(activeConversationFilterCount({ state: "active", unread: true, projects: ["p1"] })).toBe(
      3,
    );
    expect(conversationProjectOptions(entries)).toEqual([
      { value: "p2", label: "Docs" },
      { value: "p1", label: "Otomat" },
    ]);
  });
});
