// @vitest-environment happy-dom
import { InstancesPanel } from "@web/components/settings/execution-host/instances-panel";
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

async function renderPanel(expectedBuild: string | null = "92584b0") {
  const mounted = await mountWithQuery(
    <InstancesPanel sshAlias="otomat-vps" expectedBuild={expectedBuild} remoteBuild={null} />,
  );
  cleanups.push(mounted.cleanup);
}

it("lists instances with stop and delete controls", async () => {
  const stopInstance = vi.fn(() => Promise.resolve({ ok: true as const }));
  const deleteInstance = vi.fn(() => Promise.resolve({ ok: true as const }));
  window.otomat = fakeDesktopBridge();
  window.otomat.executionHost.listInstances = () =>
    Promise.resolve({
      ok: true as const,
      instances: [{ build: "92584b0", running: true, size_kb: 2048, port: 43123 }],
    });
  window.otomat.executionHost.stopInstance = stopInstance;
  window.otomat.executionHost.deleteInstance = deleteInstance;

  await renderPanel();

  expect(document.body.textContent).toContain("92584b0");
  expect(document.body.textContent).toContain("port 43123");
  await act(async () => {
    findButton("Stop")?.click();
  });
  expect(stopInstance).toHaveBeenCalledWith("92584b0");
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
