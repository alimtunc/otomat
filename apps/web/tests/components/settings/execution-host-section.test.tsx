// @vitest-environment happy-dom
import type { RemoteHostStatus } from "@otomat/domain";
import { ExecutionHostSection } from "@web/components/settings/execution-host/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const { agentCapacity, setAgentCapacity } = vi.hoisted(() => ({
  agentCapacity: vi.fn(() =>
    Promise.resolve({ max_concurrent_sessions: 4, active_sessions: 0, waiting_sessions: 0 }),
  ),
  setAgentCapacity: vi.fn((request: { max_concurrent_sessions: number }) =>
    Promise.resolve({ ...request, active_sessions: 0, waiting_sessions: 0 }),
  ),
}));

vi.mock("@web/api/client", () => ({ daemon: { agentCapacity, setAgentCapacity } }));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
  agentCapacity.mockClear();
  setAgentCapacity.mockClear();
});

async function renderSection() {
  const mounted = await mountWithQuery(<ExecutionHostSection />);
  cleanups.push(mounted.cleanup);
  // The per-host capacity queries only start once the snapshot renders its rows.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return mounted;
}

it("explains that hosts are desktop-managed when no bridge is present", async () => {
  await renderSection();
  expect(document.body.textContent).toContain("Managed by the desktop app");
});

it("still sets the cap of the daemon a browser cockpit is talking to", async () => {
  await renderSection();

  const input = document.querySelector<HTMLInputElement>(
    "input[aria-label='Maximum concurrent agent sessions on this daemon']",
  );
  if (input === null) throw new Error("capacity input not found");
  expect(input.value).toBe("4");

  await act(async () => {
    setInputValue(input, "6");
  });
  await act(async () => {
    input.closest("form")?.querySelector("button")?.click();
  });

  expect(setAgentCapacity).toHaveBeenCalledWith({ max_concurrent_sessions: 6 });
});

it("lists both hosts and marks the active one, without a manual switch", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("otomat-vps");
  expect(document.body.textContent).toContain("Active");
  // The host follows the selected project; Settings only manages the host list.
  const switchButtons = [...document.querySelectorAll("button")].filter(
    (candidate) => candidate.textContent?.trim() === "Use this host",
  );
  expect(switchButtons).toHaveLength(0);
});

it("surfaces a snapshot failure instead of an endless skeleton", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.reject(new Error("bridge unavailable"));
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("Could not load the execution-host state");
  expect(document.body.textContent).toContain("bridge unavailable");
});

it("renders live remote status pushed by the main process", async () => {
  let push: ((status: RemoteHostStatus) => void) | null = null;
  const bridge = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  bridge.executionHost.snapshot = () =>
    Promise.resolve(
      twoHostSnapshot({ active_id: "remote", remote_status: { phase: "connected", detail: null } }),
    );
  bridge.executionHost.onRemoteStatus = (listener) => {
    push = listener;
    return () => {};
  };
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("Connected");
  await act(async () => {
    push?.({ phase: "reconnecting", detail: "connection reset" });
  });
  expect(document.body.textContent).toContain("Reconnecting…");
  expect(document.body.textContent).toContain("connection reset");
});

it("warns when the remote daemon build differs from the app's expected build", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () =>
    Promise.resolve(twoHostSnapshot({ remote_build: "aaa1111", expected_build: "bbb2222" }));
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("runs build aaa1111");
  expect(document.body.textContent).toContain("expects bbb2222");
});

it("stays quiet when the remote daemon build matches", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () =>
    Promise.resolve(twoHostSnapshot({ remote_build: "aaa1111", expected_build: "aaa1111" }));
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).not.toContain("Redeploy the daemon");
});

it("removes the host after an explicit confirm, warning what actually happens", async () => {
  const removeRemote = vi.fn(() => Promise.resolve({ ok: true as const }));
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  bridge.executionHost.removeRemote = removeRemote;
  window.otomat = bridge;
  await renderSection();

  const remove = findButton("Remove");
  await act(async () => {
    remove?.click();
  });

  expect(removeRemote).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Nothing is deleted on the server");

  const confirm = findButton("Remove host");
  await act(async () => {
    confirm?.click();
  });
  expect(removeRemote).toHaveBeenCalledTimes(1);
});

it("surfaces the refusal when the host cannot be removed while active", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot({ active_id: "remote" }));
  bridge.executionHost.removeRemote = () =>
    Promise.resolve({ ok: false as const, message: "Switch to a local project first." });
  window.otomat = bridge;
  await renderSection();

  const remove = findButton("Remove");
  await act(async () => {
    remove?.click();
  });
  const confirm = findButton("Remove host");
  await act(async () => {
    confirm?.click();
  });

  expect(document.body.textContent).toContain("Switch to a local project first.");
});

it("saves the configured alias", async () => {
  const configureRemote = vi.fn(() => Promise.resolve({ ok: true as const }));
  const bridge = fakeDesktopBridge();
  bridge.executionHost.configureRemote = configureRemote;
  window.otomat = bridge;
  await renderSection();

  const input = document.querySelector<HTMLInputElement>(
    "input[aria-label='Remote host SSH alias']",
  );
  if (input === null) throw new Error("alias input not found");
  await act(async () => {
    setInputValue(input, "otomat-vps");
  });
  const save = findButton("Save");
  await act(async () => {
    save?.click();
  });
  expect(configureRemote).toHaveBeenCalledWith("otomat-vps");
});

function capacityForm(hostLabel: string): { input: HTMLInputElement; apply: HTMLButtonElement } {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label='Maximum concurrent agent sessions on ${hostLabel}']`,
  );
  const apply = input?.closest("form")?.querySelector("button");
  if (input === null || !apply) throw new Error(`no capacity form for ${hostLabel}`);
  return { input, apply };
}

it("reads each host's own cap and saves it on that host", async () => {
  const writeCapacity = vi.fn((_hostId: unknown, max: number) =>
    Promise.resolve({
      ok: true as const,
      capacity: { max_concurrent_sessions: max, active_sessions: 0, waiting_sessions: 0 },
    }),
  );
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  bridge.executionHost.readCapacity = (hostId) =>
    Promise.resolve({
      ok: true as const,
      capacity: {
        max_concurrent_sessions: hostId === "local" ? 4 : 8,
        active_sessions: hostId === "local" ? 4 : 0,
        waiting_sessions: hostId === "local" ? 2 : 0,
      },
    });
  bridge.executionHost.writeCapacity = writeCapacity;
  window.otomat = bridge;
  await renderSection();

  expect(capacityForm("Local").input.value).toBe("4");
  expect(capacityForm("otomat-vps").input.value).toBe("8");
  expect(document.body.textContent).toContain("Applying 4 — 4 active, 2 queued");

  await act(async () => {
    setInputValue(capacityForm("otomat-vps").input, "6");
  });
  await act(async () => {
    capacityForm("otomat-vps").apply.click();
  });

  expect(writeCapacity).toHaveBeenCalledWith("remote", 6);
  expect(capacityForm("Local").input.value).toBe("4");
});

it("refuses a cap that is not a positive whole number before asking the host", async () => {
  const writeCapacity = vi.fn();
  const bridge = fakeDesktopBridge();
  bridge.executionHost.writeCapacity = writeCapacity;
  window.otomat = bridge;
  await renderSection();

  await act(async () => {
    setInputValue(capacityForm("Local").input, "0");
  });

  expect(document.body.textContent).toContain("Enter a whole number of sessions, 1 or more.");
  expect(capacityForm("Local").apply.disabled).toBe(true);
  await act(async () => {
    capacityForm("Local").apply.click();
  });
  expect(writeCapacity).not.toHaveBeenCalled();
});

it("shows the cap the host confirmed, not the one that was typed", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.writeCapacity = () =>
    Promise.resolve({
      ok: true as const,
      capacity: { max_concurrent_sessions: 12, active_sessions: 0, waiting_sessions: 0 },
    });
  window.otomat = bridge;
  await renderSection();

  await act(async () => {
    setInputValue(capacityForm("Local").input, "99");
  });
  await act(async () => {
    capacityForm("Local").apply.click();
  });

  expect(capacityForm("Local").input.value).toBe("12");
});

it("says a remote save was refused instead of showing the value as applied", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  bridge.executionHost.writeCapacity = () =>
    Promise.resolve({
      ok: false as const,
      message: "The remote host is not connected yet. Try again once its tunnel is up.",
    });
  window.otomat = bridge;
  await renderSection();

  await act(async () => {
    setInputValue(capacityForm("otomat-vps").input, "9");
  });
  await act(async () => {
    capacityForm("otomat-vps").apply.click();
  });

  expect(document.body.textContent).toContain("The remote host is not connected yet.");
  // The draft stays on screen: nothing was applied, so nothing snaps back to a saved value.
  expect(capacityForm("otomat-vps").input.value).toBe("9");
});

it("surfaces a host that cannot report its cap at all", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.readCapacity = () =>
    Promise.resolve({
      ok: false as const,
      message: "Could not reach the local daemon: ECONNREFUSED",
    });
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("Could not reach the local daemon: ECONNREFUSED");
});
