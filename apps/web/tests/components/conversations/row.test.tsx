// @vitest-environment happy-dom
import { ConversationRow } from "@web/components/conversations/row";
import { describe, expect, it, vi } from "vitest";

import { conversationEntry } from "#support/conversations";
import { findLabelled } from "#support/dom-queries";
import { mountRouted } from "#support/router";

async function render(entry = conversationEntry(), selected = false) {
  const onMark = vi.fn();
  const mounted = await mountRouted(
    <ConversationRow entry={entry} selected={selected} pending={false} onMark={onMark} />,
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
  it("names the step, its state as an icon, the last line and the participant", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).not.toContain("OTO-1");
    expect(container.textContent).toContain("Implement");
    expect(container.textContent).not.toContain("Running");
    expect(container.querySelector('[aria-label="Running"][title="Running"]')).not.toBeNull();
    expect(container.textContent).toContain("Root cause found.");
    expect(container.textContent).toContain("claude · opus");
    expect(container.textContent).toContain("Unread");
    await cleanup();
  });

  it("selects its exact thread through the URL and keeps every control outside the link", async () => {
    const { link, container, cleanup } = await render(conversationEntry(), true);

    expect(link.getAttribute("href")).toBe("/conversations?run=run-1&step=step-1");
    expect(link.getAttribute("aria-current")).toBe("true");
    expect(link.querySelector("button")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
    await cleanup();
  });

  it("offers to flip the reading and to archive without touching the step", async () => {
    const { link, onMark, cleanup } = await render(conversationEntry({ read: true }));

    control("Mark as unread").click();
    control("Archive").click();
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
});
