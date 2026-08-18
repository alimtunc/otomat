// @vitest-environment happy-dom
import { CopyablePath } from "@web/components/runs/copyable-path";
import { afterEach, expect, it } from "vitest";

import { mount, type Mounted } from "#support/mount";

const LONG_PATH =
  "/home/ubuntu/.otomat/local/data/worktrees/ca83bd19-91a8-4c38-8cd8-941b49246f99-a3ed2ac6";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("keeps the whole value in the DOM so it stays selectable and readable to a screen reader", async () => {
  view = await mount(<CopyablePath value={LONG_PATH} label="worktree path" />);

  const value = view.container.querySelector("bdi");
  expect(value?.textContent).toBe(LONG_PATH);
  expect(view.container.querySelector("[title]")?.getAttribute("title")).toBe(LONG_PATH);
  expect(view.container.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe(
    `worktree path: ${LONG_PATH}`,
  );
});

it("ellipsises the value's start, so the meaningful tail survives a narrow rail", async () => {
  view = await mount(<CopyablePath value={LONG_PATH} label="worktree path" />);

  const value = view.container.querySelector("[title]");
  expect(value?.getAttribute("dir")).toBe("rtl");
  expect(value?.className).toContain("truncate");
  expect(value?.className).toContain("min-w-0");
});

it("keeps the value focusable and the copy control present at any width", async () => {
  view = await mount(<CopyablePath value={LONG_PATH} label="worktree path" />);

  expect(view.container.querySelector("[title]")?.getAttribute("tabindex")).toBe("0");
  const copy = view.container.querySelector('[aria-label="Copy worktree path"]');
  expect(copy).not.toBeNull();
  expect(copy?.className).not.toContain("hidden");
});
