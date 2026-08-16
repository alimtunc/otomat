// @vitest-environment happy-dom
import type { ExecutionHostSnapshot, RemoteHostStatus } from "@otomat/domain";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { useShellData } from "@web/components/shell/use-shell-data";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { mountWithQuery } from "#support/mount";

vi.mock("@web/api/daemon/queries", () => ({
  // The tunnel is not up yet, so the health poll fails throughout the bootstrap.
  useDaemonStatus: () => ({ connectionState: "offline", lastSyncAt: null, retry: () => {} }),
  useHealth: () => ({ data: undefined }),
}));

vi.mock("@web/api/runs/queries", () => ({ useProjectRuns: () => ({ data: [] }) }));

vi.mock("@web/components/shell/project-selection/use-project-switcher", () => ({
  useProjectSwitcher: () => ({ projectLabel: "Otomat", projects: [], hostOptions: [] }),
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

function SessionProbe() {
  const remote = useRemoteSession();
  const shell = useShellData();
  return (
    <dl>
      <dd data-testid="connection">{shell.connectionState}</dd>
      <dd data-testid="label">{shell.connectionLabel ?? "—"}</dd>
      <dd data-testid="settling">{String(remote.settling)}</dd>
      <dd data-testid="update-pending">{String(remote.updatePending)}</dd>
      <dd data-testid="update-error">{remote.updateError ?? "—"}</dd>
    </dl>
  );
}

function snapshot(overrides: Partial<ExecutionHostSnapshot> = {}): ExecutionHostSnapshot {
  return twoHostSnapshot({
    active_id: "remote",
    remote_status: { phase: "checking_host", detail: "ssh otomat-vps" },
    remote_build: "aaa1111",
    expected_build: "aaa1111",
    ...overrides,
  });
}

async function renderProbe(overrides: Partial<ExecutionHostSnapshot> = {}) {
  let push: ((status: RemoteHostStatus) => void) | null = null;
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(snapshot(overrides));
  bridge.executionHost.onRemoteStatus = (listener) => {
    push = listener;
    return () => {};
  };
  window.otomat = bridge;
  const mounted = await mountWithQuery(<SessionProbe />);
  cleanups.push(mounted.cleanup);
  const read = (id: string) =>
    mounted.container.querySelector(`[data-testid='${id}']`)?.textContent;
  return {
    read,
    push: async (status: RemoteHostStatus) => {
      await act(async () => {
        push?.(status);
      });
    },
  };
}

it("reads a remote bootstrap as progress, never as an offline daemon", async () => {
  const probe = await renderProbe();

  expect(probe.read("settling")).toBe("true");
  expect(probe.read("connection")).toBe("reconnecting");
  expect(probe.read("label")).toBe("Connecting to otomat-vps…");
});

it("names each step of the journey as the main process pushes it", async () => {
  const probe = await renderProbe();

  await probe.push({ phase: "checking_version", detail: null });
  expect(probe.read("label")).toBe("Checking the daemon version…");

  await probe.push({ phase: "installing_update", detail: "bbb2222" });
  expect(probe.read("label")).toBe("Installing the daemon update…");

  await probe.push({ phase: "verifying_update", detail: "bbb2222" });
  expect(probe.read("label")).toBe("Restarting and verifying the daemon…");
  expect(probe.read("connection")).toBe("reconnecting");
});

it("serves the cockpit normally while an update waits for the runs in flight", async () => {
  const probe = await renderProbe();

  await probe.push({ phase: "waiting_for_runs", active_runs: 2, detail: null });

  // That wait lasts as long as the runs do, and the tunnel serves the cockpit throughout it.
  expect(probe.read("settling")).toBe("false");
  expect(probe.read("connection")).toBe("offline");
});

it("falls through to the daemon's own connection state once the host has settled", async () => {
  const probe = await renderProbe();

  await probe.push({ phase: "connected", detail: null });

  expect(probe.read("settling")).toBe("false");
  expect(probe.read("connection")).toBe("offline");
  expect(probe.read("label")).toBe("—");
});

it("pauses launches while the active host runs a build this app did not ask for", async () => {
  const probe = await renderProbe({ remote_build: "aaa1111", expected_build: "bbb2222" });

  expect(probe.read("update-pending")).toBe("true");
});

it("leaves a local host alone: nothing settles, nothing waits", async () => {
  const probe = await renderProbe({ active_id: "local" });

  expect(probe.read("settling")).toBe("false");
  expect(probe.read("update-pending")).toBe("false");
  expect(probe.read("connection")).toBe("offline");
});

it("carries the reason the last automatic update stopped", async () => {
  const probe = await renderProbe({ remote_update_error: "no CI artifact is named …" });

  expect(probe.read("update-error")).toBe("no CI artifact is named …");
});
