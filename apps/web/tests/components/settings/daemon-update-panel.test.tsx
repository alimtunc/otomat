// @vitest-environment happy-dom
import type { ExecutionHostSnapshot } from "@otomat/domain";
import { DaemonUpdatePanel } from "@web/components/settings/execution-host/daemon-update-panel";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

function snapshot(overrides: Partial<ExecutionHostSnapshot> = {}): ExecutionHostSnapshot {
  return twoHostSnapshot({
    active_id: "remote",
    remote_status: { phase: "connected", detail: null },
    remote_build: "aaa1111",
    expected_build: "bbb2222",
    ...overrides,
  });
}

async function renderPanel(overrides: Partial<ExecutionHostSnapshot> = {}) {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(snapshot(overrides));
  window.otomat = bridge;
  const mounted = await mountWithQuery(<DaemonUpdatePanel />);
  cleanups.push(mounted.cleanup);
  return bridge;
}

it("says the host is behind and that Otomat installs the exact build by itself", async () => {
  await renderPanel();

  expect(document.body.textContent).toContain("The host runs build aaa1111");
  expect(document.body.textContent).toContain("this app expects bbb2222");
  expect(document.body.textContent).toContain("once the host has no run in flight");
});

it("names the runs an update is waiting on, and what closing the app does to them", async () => {
  await renderPanel({
    remote_status: { phase: "waiting_for_runs", active_runs: 2, detail: null },
  });

  expect(document.body.textContent).toContain("Update waiting on 2 runs…");
  expect(document.body.textContent).toContain("closing Otomat does not stop them");
});

it("says a host that could not list its runs did not answer, rather than implying it is busy", async () => {
  await renderPanel({
    remote_status: {
      phase: "waiting_for_runs",
      active_runs: 0,
      detail: "the daemon did not answer",
    },
  });

  expect(document.body.textContent).toContain("the daemon did not answer");
});

it("renders a bundle CI has not published yet as progress, never as a failed update", async () => {
  await renderPanel({
    remote_status: { phase: "waiting_for_artifact", detail: "its CI run is still running" },
    remote_update_error: "the CI run for build bbb2222 ended as failure",
  });

  const waiting = [...document.querySelectorAll('[role="status"]')].at(-1);
  expect(waiting?.textContent).toContain("Waiting for the CI artifact…");
  expect(waiting?.textContent).toContain("its CI run is still running");
  const alert = document.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("ended as failure");
  expect(alert?.textContent).not.toContain("Waiting for the CI artifact");
});

it("keeps naming the step through the restart, the longest one an update takes", async () => {
  await renderPanel({ remote_status: { phase: "verifying_update", detail: "bbb2222" } });

  expect(document.body.textContent).toContain("Restarting and verifying the daemon…");
});

it("keeps the exact cause of a failed install, with a retry that runs the same one", async () => {
  const updateRemoteDaemon = vi.fn(() => Promise.resolve({ ok: true as const }));
  const bridge = await renderPanel({
    remote_update_error:
      "The update stopped: no CI artifact is named otomat-daemon-bbb2222-linux-x64.",
  });
  bridge.executionHost.updateRemoteDaemon = updateRemoteDaemon;

  expect(document.body.textContent).toContain("no CI artifact is named");
  expect(document.body.textContent).toContain("database with it");

  await act(async () => {
    findButton("Install bbb2222 now")?.click();
  });

  expect(updateRemoteDaemon).toHaveBeenCalledOnce();
});

it("surfaces a refused retry rather than reporting it as done", async () => {
  const bridge = await renderPanel();
  bridge.executionHost.updateRemoteDaemon = () =>
    Promise.resolve({ ok: false as const, message: "The remote host is not connected yet." });

  await vi.waitFor(() => expect(findButton("Install bbb2222 now")).not.toBeNull());
  await act(async () => {
    findButton("Install bbb2222 now")?.click();
  });

  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("The remote host is not connected yet."),
  );
});

it("stays quiet on a host that runs the expected build", async () => {
  await renderPanel({ remote_build: "bbb2222" });

  expect(document.body.textContent).toContain("runs the build this app expects");
  expect(document.body.textContent).not.toContain("this app expects bbb2222.");
});

it("says nothing can be installed when this app cannot name its own commit", async () => {
  await renderPanel({ expected_build: null });

  expect(findButton("Install this build now")?.disabled).toBe(true);
  expect(document.body.textContent).toContain("cannot name its own commit");
});
