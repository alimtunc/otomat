// @vitest-environment happy-dom
import { DiffShortcutsPopover } from "@web/components/runs/diff/shortcuts-popover";
import { act } from "react";
import { expect, it } from "vitest";

import { mount } from "#support/mount";

it("keeps navigation help behind a compact shortcuts popover", async () => {
  const mounted = await mount(<DiffShortcutsPopover />);
  const trigger = mounted.container.querySelector<HTMLButtonElement>(
    'button[aria-label="Keyboard shortcuts"]',
  );
  if (trigger === null) throw new Error("the shortcuts trigger is missing");
  expect(document.body.textContent).not.toContain("Previous / next file");

  await act(async () => trigger.click());

  expect(document.body.textContent).toContain("Previous / next file");
  expect(document.body.textContent).toContain("Find in diff");
  expect(document.body.textContent).toContain("Clear search / go back");
  await mounted.cleanup();
});
