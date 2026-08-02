// @vitest-environment happy-dom
import type { ExecutionHostId, ExecutionHostSnapshot, RemoteHostStatus } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExecutionHostSection } from "@web/components/settings/execution-host/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

async function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <ExecutionHostSection />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
  // React Query dispatches fetch results on a macrotask; flush two timer ticks before asserting.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return mounted;
}

function hostSelectButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll("button")].filter(
    (candidate) => candidate.textContent?.trim() === "Use this host",
  );
}

function twoHostSnapshot(overrides: Partial<ExecutionHostSnapshot> = {}): ExecutionHostSnapshot {
  return {
    hosts: [
      { id: "local", label: "Local", kind: "local" },
      { id: "remote", label: "otomat-vps", kind: "ssh" },
    ],
    active_id: "local",
    remote_ssh_alias: "otomat-vps",
    remote_status: null,
    ...overrides,
  };
}

it("explains that hosts are desktop-managed when no bridge is present", async () => {
  await renderSection();
  expect(document.body.textContent).toContain("Managed by the desktop app");
});

it("lists both hosts, marks the active one, and switches on demand", async () => {
  const select = vi.fn<(id: ExecutionHostId) => Promise<{ ok: true }>>(() =>
    Promise.resolve({ ok: true as const }),
  );
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  bridge.executionHost.select = select;
  window.otomat = bridge;
  await renderSection();

  expect(document.body.textContent).toContain("otomat-vps");
  expect(document.body.textContent).toContain("Active");
  const buttons = hostSelectButtons();
  expect(buttons).toHaveLength(1);
  await act(async () => {
    buttons[0]?.click();
  });
  expect(select).toHaveBeenCalledWith("remote");
});

it("shows the selection failure instead of pretending to be connected", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = () => Promise.resolve(twoHostSnapshot());
  bridge.executionHost.select = () =>
    Promise.resolve({
      ok: false as const,
      status: { phase: "error" as const, code: "ssh_unreachable" as const, detail: "no route" },
    });
  window.otomat = bridge;
  await renderSection();

  await act(async () => {
    hostSelectButtons()[0]?.click();
  });
  expect(document.body.textContent).toContain("could not be reached over SSH");
  expect(document.body.textContent).toContain("no route");
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
  const save = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Save",
  );
  await act(async () => {
    save?.click();
  });
  expect(configureRemote).toHaveBeenCalledWith("otomat-vps");
});
