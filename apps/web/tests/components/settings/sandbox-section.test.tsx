// @vitest-environment happy-dom
import { SandboxSection } from "@web/components/settings/sandbox/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

async function renderSection() {
  const mounted = await mount(<SandboxSection />);
  cleanups.push(mounted.cleanup);
}

it("tells non-preview builds the sandbox does not exist for them", async () => {
  window.otomat = fakeDesktopBridge();

  await renderSection();

  expect(document.body.textContent).toContain("Preview builds only");
  expect(findButton("Reset test data")).toBeUndefined();
});

it("resets through the bridge and stays pending while the window reload is coming", async () => {
  const reset = vi.fn(() => Promise.resolve({ ok: true as const, message: null }));
  window.otomat = fakeDesktopBridge({ preview: true, sandbox: { reset } });

  await renderSection();
  const button = findButton("Reset test data");
  expect(button).toBeDefined();
  await act(async () => {
    button?.click();
  });

  expect(reset).toHaveBeenCalledOnce();
  expect(findButton("Resetting…")?.disabled).toBe(true);
});

it("surfaces a refused reset", async () => {
  const reset = vi.fn(() =>
    Promise.resolve({ ok: false as const, message: "The daemon refused to stop." }),
  );
  window.otomat = fakeDesktopBridge({ preview: true, sandbox: { reset } });

  await renderSection();
  await act(async () => {
    findButton("Reset test data")?.click();
  });

  expect(document.body.textContent).toContain("The daemon refused to stop.");
  expect(findButton("Reset test data")?.disabled).toBe(false);
});
