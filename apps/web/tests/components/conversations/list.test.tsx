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

it("opens the selected issue and makes a single conversation directly accessible", async () => {
  const { container, cleanup } = await mountRouted(
    <ConversationList
      sections={sections}
      selectedId="conversation:step-2"
      pending={false}
      onMark={vi.fn()}
    />,
  );

  expect(headers(container)).toHaveLength(1);
  expect(headers(container)[0]?.textContent).toContain("Ship it");
  const [first] = container.querySelectorAll("h3 + ul");
  expect(first?.textContent).toContain("Implement");
  expect(first?.textContent).toContain("Review");
  expect(first?.textContent).not.toContain("Docs");
  expect(container.querySelectorAll("[data-conversation-row]")).toHaveLength(3);
  expect(container.textContent).toContain("Write docs");
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

it("folds finished conversations by default while keeping their unread count visible", async () => {
  const finished = groupConversations([
    conversationEntry({
      id: "conversation:finished",
      step_run_id: "finished",
      issue: { id: "finished-issue", identifier: "OTO-3", title: "Finished work", cycle: null },
    }),
  ]);
  const { container, cleanup } = await mountRouted(
    <ConversationList sections={finished} selectedId={null} pending={false} onMark={vi.fn()} />,
  );
  const history = container.querySelector<HTMLButtonElement>("h2 button");
  expect(history?.getAttribute("aria-expanded")).toBe("false");
  expect(history?.textContent).toContain("1 unread");
  expect(container.querySelectorAll("[data-conversation-row]")).toHaveLength(0);
  await act(async () => history?.click());
  expect(container.textContent).toContain("Finished work");
  await cleanup();
});
