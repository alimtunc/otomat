// @vitest-environment happy-dom
import { InlineTextField } from "@web/components/issues/workspace/linear/inline-text-field";
import { act } from "react";
import { expect, it } from "vitest";

import { mount } from "#support/mount";

const DESCRIPTION = [
  "## Scope",
  "",
  "- A shared renderer",
  "- Linked from [Linear](https://linear.app/otomat)",
].join("\n");

const EDIT = 'button[aria-label="Edit issue description"]';

function editButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(EDIT);
}

it("shows a Linear description as a rendered document with clickable links", async () => {
  const { container, cleanup } = await mount(
    <InlineTextField
      multiline
      value={DESCRIPTION}
      placeholder="Add a description…"
      ariaLabel="Issue description"
      onCommit={() => {}}
    />,
  );

  expect(container.querySelector("h2")?.textContent).toBe("Scope");
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container.querySelector("a")?.getAttribute("href")).toBe("https://linear.app/otomat");
  expect(container.textContent).not.toContain("## Scope");
  expect(container.querySelector("textarea")).toBeNull();

  await cleanup();
});

it("still opens the raw text for editing", async () => {
  const { container, cleanup } = await mount(
    <InlineTextField
      multiline
      value={DESCRIPTION}
      placeholder="Add a description…"
      ariaLabel="Issue description"
      onCommit={() => {}}
    />,
  );

  await act(async () => editButton(container)?.click());

  expect(container.querySelector("textarea")?.value).toBe(DESCRIPTION);

  await cleanup();
});

it("keeps click-to-edit for an empty description", async () => {
  const { container, cleanup } = await mount(
    <InlineTextField
      multiline
      value=""
      placeholder="Add a description…"
      ariaLabel="Issue description"
      onCommit={() => {}}
    />,
  );

  const trigger = editButton(container);
  expect(trigger?.textContent).toBe("Add a description…");

  await act(async () => trigger?.click());

  expect(container.querySelector("textarea")).not.toBeNull();

  await cleanup();
});
