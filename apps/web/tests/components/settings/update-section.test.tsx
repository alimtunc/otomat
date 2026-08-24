// @vitest-environment happy-dom
import type { DesktopUpdateSnapshot } from "@otomat/domain";
import { UpdateSection } from "@web/components/settings/update-section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

function snapshot(overrides: Partial<DesktopUpdateSnapshot> = {}): DesktopUpdateSnapshot {
  return {
    state: "up_to_date",
    current_version: "0.1.0-alpha.1",
    feed: "prerelease",
    release: null,
    progress: null,
    checked_at: "2026-08-22T10:00:00.000Z",
    detail: null,
    manual_url: null,
    ...overrides,
  };
}

async function renderSection(
  state: DesktopUpdateSnapshot | null,
  actions: { check?: () => Promise<void>; install?: () => Promise<void> } = {},
) {
  window.otomat = fakeDesktopBridge({
    update: {
      snapshot: () => Promise.resolve(state),
      check: actions.check ?? (() => Promise.resolve()),
      install: actions.install ?? (() => Promise.resolve()),
      onChange: () => () => {},
    },
  });
  const mounted = await mountWithQuery(<UpdateSection />);
  cleanups.push(mounted.cleanup);
}

it("renders nothing in a browser cockpit, where there is no app to replace", async () => {
  await renderSection(null);

  expect(document.body.textContent).not.toContain("Updates");
});

it("names the channel and the version it is on when there is nothing to do", async () => {
  await renderSection(snapshot());

  expect(document.body.textContent).toContain("prerelease channel · 0.1.0-alpha.1");
  expect(document.body.textContent).toContain("Otomat 0.1.0-alpha.1 is up to date");
  expect(findButton("Install and restart")).toBeUndefined();
});

it("shows the release notes and asks for consent before replacing anything", async () => {
  const install = vi.fn(() => Promise.resolve());
  await renderSection(
    snapshot({
      state: "ready",
      release: { version: "0.1.0-alpha.2", notes: "Fixed the thing", released_at: null },
    }),
    { install },
  );

  expect(document.body.textContent).toContain("Otomat 0.1.0-alpha.2 is ready to install");
  expect(document.body.textContent).toContain("Fixed the thing");
  expect(install).not.toHaveBeenCalled();

  await act(async () => {
    findButton("Install and restart")?.click();
  });
  expect(install).toHaveBeenCalledOnce();
});

it("reports the download progress it actually has", async () => {
  await renderSection(
    snapshot({
      state: "downloading",
      progress: 42,
      release: { version: "0.1.0-alpha.2", notes: "", released_at: null },
    }),
  );

  expect(document.body.textContent).toContain("Downloading Otomat 0.1.0-alpha.2 — 42%");
});

it("names the host in the way instead of offering a silent install", async () => {
  await renderSection(
    snapshot({
      state: "waiting_for_runs",
      detail: "otomat-vps still has 1 run in flight.",
      release: { version: "0.1.0-alpha.2", notes: "", released_at: null },
    }),
  );

  expect(document.body.textContent).toContain("otomat-vps still has 1 run in flight.");
  expect(findButton("Install and restart")).toBeDefined();
});

it("offers a manual download, and no check, to a build that cannot replace itself", async () => {
  await renderSection(
    snapshot({
      state: "manual_only",
      detail: "This build is not the signed release.",
      manual_url: "https://github.com/alimtunc/otomat/releases/latest",
      checked_at: null,
    }),
  );

  expect(findButton("Check for updates")).toBeUndefined();
  const link = document.body.querySelector("a");
  expect(link?.getAttribute("href")).toBe("https://github.com/alimtunc/otomat/releases/latest");
  expect(document.body.textContent).toContain("This build is not the signed release.");
});

it("checks on demand", async () => {
  const check = vi.fn(() => Promise.resolve());
  await renderSection(snapshot(), { check });

  await act(async () => {
    findButton("Check for updates")?.click();
  });

  expect(check).toHaveBeenCalledOnce();
});

it("says the update stopped and keeps the current version on screen", async () => {
  await renderSection(snapshot({ state: "failed", detail: "sha512 mismatch" }));

  expect(document.body.textContent).toContain("The update stopped, and nothing was replaced");
  expect(document.body.textContent).toContain("sha512 mismatch");
  expect(document.body.textContent).toContain("0.1.0-alpha.1");
});
