// @vitest-environment happy-dom
import { ConversationRow, type ConversationRowProps } from "@web/components/conversations/row";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { conversationEntry, terminalConversationEntry } from "#support/conversations";
import { findLabelled, findMenuItem } from "#support/dom-queries";
import { mountRouted } from "#support/router";

async function render(props: Partial<ConversationRowProps> = {}) {
  const onMark = vi.fn();
  const mounted = await mountRouted(
    <ConversationRow
      entry={conversationEntry()}
      selected={false}
      pending={false}
      onMark={onMark}
      {...props}
    />,
  );
  const link = mounted.container.querySelector("a");
  if (link === null) throw new Error("conversation row is not a link");
  return { ...mounted, link, onMark };
}

function control(label: string): HTMLElement {
  const found = findLabelled(label);
  if (found === undefined) throw new Error(`no control labelled ${label}`);
  return found;
}

describe("ConversationRow", () => {
  it("names the step, its actionable state and the last line without participant metadata", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).not.toContain("OTO-1");
    expect(container.textContent).toContain("Implement");
    expect(container.querySelector('[aria-label="Cockpit chat"]')).not.toBeNull();
    expect(container.textContent).toContain("Running");
    expect(container.textContent).toContain("Root cause found.");
    expect(container.textContent).not.toContain("claude");
    expect(container.textContent).not.toContain("opus");
    expect(container.textContent).toContain("Unread");
    await cleanup();
  });

  it("selects its exact thread through the URL and keeps every control outside the link", async () => {
    const { link, container, cleanup } = await render({ selected: true });

    expect(link.getAttribute("href")).toBe("/conversations?run=run-1&step=step-1");
    expect(link.getAttribute("aria-current")).toBe("true");
    expect(link.querySelector("button")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(link.parentElement?.className).toContain("border-l-iris");
    await cleanup();
  });

  it("offers to flip the reading and to archive without touching the step", async () => {
    const { link, onMark, cleanup } = await render({ entry: conversationEntry({ read: true }) });

    await act(async () => control("Conversation actions").click());
    const unread = findMenuItem("Mark as unread");
    if (unread === undefined) throw new Error("no unread menu item");
    await act(async () => unread.click());
    await act(async () => control("Conversation actions").click());
    const archive = findMenuItem("Archive");
    if (archive === undefined) throw new Error("no archive menu item");
    await act(async () => archive.click());
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }));
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));

    expect(onMark.mock.calls).toEqual([
      [{ read: false }],
      [{ archived: true }],
      [{ read: false }],
      [{ archived: true }],
    ]);
    await cleanup();
  });

  it("shows the issue directly for a single thread and omits a success badge", async () => {
    const { container, cleanup } = await render({
      showIssue: true,
      entry: conversationEntry({ step_status: "succeeded" }),
    });

    expect(container.textContent).toContain("OTO-1");
    expect(container.textContent).toContain("Ship it");
    expect(container.textContent).toContain("Root cause found.");
    expect(container.textContent).not.toContain("Implement");
    expect(container.textContent).not.toContain("Succeeded");
    await cleanup();
  });

  it("keeps a pending question ahead of the excerpt even when the step succeeded", async () => {
    const { container, cleanup } = await render({
      entry: conversationEntry({
        step_status: "succeeded",
        pending_interaction: { kind: "permission", prompt: "Run the command?" },
      }),
    });

    expect(container.textContent).toContain("Awaiting permission");
    expect(container.textContent).toContain("Permission: Run the command?");
    expect(container.textContent).not.toContain("Root cause found.");
    await cleanup();
  });

  it("disables mutation controls and shortcuts while a mark is pending", async () => {
    const { link, onMark, cleanup } = await render({ pending: true });

    expect(control("Conversation actions").hasAttribute("disabled")).toBe(true);
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }));
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    expect(onMark).not.toHaveBeenCalled();
    await cleanup();
  });
});

it("identifies a project terminal and keeps its actions separate from a run", async () => {
  const entry = terminalConversationEntry();
  const { link, container, onMark, cleanup } = await render({ entry, showIssue: true });
  expect(container.querySelector('[aria-label="Terminal"]')).not.toBeNull();
  expect(container.textContent).toContain("Otomat");
  expect(container.textContent).toContain("Codex terminal");
  expect(container.textContent).toContain("Ended");
  expect(link.getAttribute("href")).toBe(`/conversations?terminal=${entry.terminal.id}`);
  await act(async () => control("Conversation actions").click());
  const archive = findMenuItem("Archive");
  if (archive === undefined) throw new Error("no archive menu item");
  await act(async () => archive.click());
  expect(onMark).toHaveBeenCalledWith({ archived: true });
  await cleanup();
});
