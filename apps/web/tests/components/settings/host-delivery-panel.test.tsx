// @vitest-environment happy-dom
import type { LinearDeliverySnapshot } from "@otomat/domain";
import { HostDeliveryPanel } from "@web/components/settings/integrations/host-delivery-panel";
import { afterEach, expect, it } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery, type Mounted } from "#support/mount";

let rendered: Mounted | null = null;

const CONNECTED_LOCAL = {
  host_id: "local" as const,
  label: "Local",
  state: "delivered" as const,
  detail: null,
};

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  delete window.otomat;
  document.body.replaceChildren();
});

async function renderPanel(delivery: LinearDeliverySnapshot): Promise<HTMLElement> {
  const bridge = fakeDesktopBridge();
  bridge.linear.delivery = () => Promise.resolve(delivery);
  window.otomat = bridge;
  rendered = await mountWithQuery(<HostDeliveryPanel />);
  return rendered.container;
}

it("says which host is still waiting for the key, and why", async () => {
  const container = await renderPanel({
    stored: true,
    hosts: [
      CONNECTED_LOCAL,
      {
        host_id: "remote",
        label: "otomat-vps",
        state: "pending_restore",
        detail: "otomat-vps is not connected yet.",
      },
    ],
  });

  expect(container.textContent).toContain("otomat-vps");
  expect(container.textContent).toContain("Waiting to receive the key");
  expect(container.textContent).toContain("otomat-vps is not connected yet.");
});

it("keeps a pending revocation visible after the key is forgotten", async () => {
  const container = await renderPanel({
    stored: false,
    hosts: [
      { host_id: "local", label: "Local", state: "cleared", detail: null },
      {
        host_id: "remote",
        label: "otomat-vps",
        state: "pending_revocation",
        detail: "otomat-vps is not connected yet.",
      },
    ],
  });

  expect(container.textContent).toContain("Waiting to revoke the key");
});

it("stays out of the way when no key is stored and nothing is owed", async () => {
  const container = await renderPanel({
    stored: false,
    hosts: [{ host_id: "local", label: "Local", state: "cleared", detail: null }],
  });

  expect(container.textContent).toBe("");
});

it("stays out of the way when an unreachable host is owed nothing", async () => {
  const container = await renderPanel({
    stored: false,
    hosts: [
      { host_id: "local", label: "Local", state: "cleared", detail: null },
      {
        host_id: "remote",
        label: "otomat-vps",
        state: "unavailable",
        detail: "otomat-vps is not connected yet.",
      },
    ],
  });

  expect(container.textContent).toBe("");
});
