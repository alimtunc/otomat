// @vitest-environment happy-dom
import { BaseBranchControl } from "@web/components/runs/launch/base-branch-control";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { readyLaunchTarget } from "#support/launch-target";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function render(target = readyLaunchTarget()) {
  const mounted = await mount(<BaseBranchControl target={target} />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

function localBaseCheckbox(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("[role='checkbox']");
}

it("offers no local-base choice while the repository has a remote to read the base from", async () => {
  await render();

  expect(localBaseCheckbox()).toBeNull();
});

it("asks for the local base explicitly when the repository has no remote", async () => {
  const setLocalBase = vi.fn();
  const target = { ...readyLaunchTarget(), hasRemote: false, setLocalBase };
  await render(target);

  const checkbox = localBaseCheckbox();
  expect(checkbox?.getAttribute("aria-checked")).toBe("false");
  await act(async () => checkbox?.click());

  expect(setLocalBase).toHaveBeenCalledWith(true);
});
