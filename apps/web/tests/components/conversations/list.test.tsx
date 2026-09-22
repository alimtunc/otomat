// @vitest-environment happy-dom
import { ConversationList } from "@web/components/conversations/list";
import { groupConversations } from "@web/lib/conversations/sections";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { conversationEntry } from "#support/conversations";
import { mountRouted } from "#support/router";

const sections = groupConversations([
  conversationEntry(),
  conversationEntry({ id: "conversation:step-2", step_run_id: "step-2", step_name: "Review" }),
  conversationEntry({
    id: "conversation:step-3",
    step_run_id: "step-3",
    step_name: "Docs",
    issue: { id: "issue-2", identifier: "OTO-2", title: "Write docs", cycle: "pr_open" },
  }),
]);

function headers(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("h3 button")];
}

it("lists each issue once, its threads beneath, with the cycle as an icon", async () => {
  const { container, cleanup } = await mountRouted(
    <ConversationList
      sections={sections}
      selectedId="conversation:step-2"
      pending={false}
      onMark={vi.fn()}
    />,
  );

  expect(headers(container).map((header) => header.textContent)).toEqual([
    "OTO-1Ship it2",
    "OTO-2Write docs1",
  ]);
  expect(container.querySelector('h3 [aria-label="PR open"]')).not.toBeNull();
  const [first] = container.querySelectorAll("h3 + ul");
  expect(first?.textContent).toContain("Implement");
  expect(first?.textContent).toContain("Review");
  expect(first?.textContent).not.toContain("Docs");
  await cleanup();
});

it("collapses a group without dropping the selected thread, and the arrows skip the hidden rows", async () => {
  const { container, cleanup } = await mountRouted(
    <ConversationList
      sections={sections}
      selectedId="conversation:step-2"
      pending={false}
      onMark={vi.fn()}
    />,
  );
  const [ship] = headers(container);
  if (ship === undefined) throw new Error("no group header");

  await act(async () => ship.click());
  expect(ship.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelectorAll("[data-conversation-row]")).toHaveLength(1);
  expect(container.querySelector('[aria-current="true"]')).toBeNull();

  await act(async () => ship.click());
  expect(ship.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector('[aria-current="true"]')?.textContent).toContain("Review");
  await cleanup();
});
