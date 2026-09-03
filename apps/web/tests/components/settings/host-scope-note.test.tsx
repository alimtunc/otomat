// @vitest-environment happy-dom
import { HostScopeNote } from "@web/components/settings/host-scope-note";
import { activeHostStore } from "@web/lib/active-host";
import { act } from "react";
import { afterEach, expect, it } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { mountWithQuery } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  activeHostStore.setState(() => null);
  delete window.otomat;
});

async function renderNote(): Promise<HTMLElement> {
  const mounted = await mountWithQuery(<HostScopeNote />);
  cleanups.push(mounted.cleanup);
  return mounted.container;
}

it("names the daemon that holds what is on screen, and follows a host switch", async () => {
  window.otomat = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  const container = await renderNote();

  expect(container.textContent).toContain("Local");
  expect(container.textContent).toContain("on this machine");
  expect(container.textContent).toContain("keeps its own");
  expect(container.textContent).not.toContain("otomat-vps");

  await act(async () => {
    activeHostStore.actions.activate({ id: "remote", daemonUrl: "http://127.0.0.1:45010" });
  });

  expect(container.textContent).toContain("otomat-vps");
  expect(container.textContent).toContain("over SSH");
});

it("says the displayed host cannot be written to while it is not answering", async () => {
  const bridge = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  bridge.executionHost.snapshot = () =>
    Promise.resolve(
      twoHostSnapshot({
        active_id: "remote",
        remote_status: { phase: "error", code: "ssh_unreachable", detail: null },
      }),
    );
  window.otomat = bridge;
  activeHostStore.setState(() => ({ id: "remote", daemonUrl: "http://127.0.0.1:45010" }));
  const container = await renderNote();

  const alert = container.querySelector("[role='alert']");
  expect(alert?.textContent).toContain("otomat-vps is not answering");
  expect(alert?.textContent).toContain("could not be reached over SSH");
});
