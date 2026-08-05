// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InstancesPanel } from "@web/components/settings/execution-host/instances-panel";
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

async function renderPanel(expectedBuild: string | null = "92584b0") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <InstancesPanel configured expectedBuild={expectedBuild} remoteBuild={null} />
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
}

it("lists instances with stop and delete controls", async () => {
  const deleteInstance = vi.fn(() => Promise.resolve({ ok: true as const }));
  window.otomat = fakeDesktopBridge();
  window.otomat.executionHost.listInstances = () =>
    Promise.resolve({
      ok: true as const,
      instances: [{ build: "92584b0", running: true, size_kb: 2048, port: 43123 }],
    });
  window.otomat.executionHost.deleteInstance = deleteInstance;

  await renderPanel();

  expect(document.body.textContent).toContain("92584b0");
  expect(document.body.textContent).toContain("port 43123");
  expect(findButton("Stop")).toBeDefined();
  await act(async () => {
    findButton("Delete")?.click();
  });
  expect(deleteInstance).toHaveBeenCalledWith("92584b0");
});

it("deploys this app's build through the bridge", async () => {
  const updateRemoteDaemon = vi.fn(() => Promise.resolve({ ok: true as const }));
  window.otomat = fakeDesktopBridge();
  window.otomat.executionHost.updateRemoteDaemon = updateRemoteDaemon;

  await renderPanel();
  await act(async () => {
    findButton("Deploy 92584b0 to this host")?.click();
  });

  expect(updateRemoteDaemon).toHaveBeenCalledOnce();
});

it("disables the deploy when the build is unidentifiable and surfaces list failures", async () => {
  window.otomat = fakeDesktopBridge();
  window.otomat.executionHost.listInstances = () =>
    Promise.resolve({ ok: false as const, message: "ssh unreachable" });

  await renderPanel(null);

  expect(findButton("Deploy this build to this host")?.disabled).toBe(true);
  expect(document.body.textContent).toContain("ssh unreachable");
});
