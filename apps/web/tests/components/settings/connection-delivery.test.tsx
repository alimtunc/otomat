// @vitest-environment happy-dom
import type { LinearConnectionDelivery } from "@otomat/domain";
import { ConnectionDelivery } from "@web/components/settings/integrations/linear/delivery";
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

async function renderPanel(
  connections: LinearConnectionDelivery[],
  connectionId = "c-otomat",
): Promise<HTMLElement> {
  const bridge = fakeDesktopBridge();
  bridge.linear.delivery = () => Promise.resolve({ connections });
  window.otomat = bridge;
  rendered = await mountWithQuery(<ConnectionDelivery connectionId={connectionId} />);
  return rendered.container;
}

it("says which host is still waiting for the key, and why", async () => {
  const container = await renderPanel([
    {
      connection_id: "c-otomat",
      hosts: [
        CONNECTED_LOCAL,
        {
          host_id: "remote",
          label: "otomat-vps",
          state: "pending_restore",
          detail: "otomat-vps is not connected yet.",
        },
      ],
    },
  ]);

  expect(container.textContent).toContain("otomat-vps");
  expect(container.textContent).toContain("Waiting to receive the key");
  expect(container.textContent).toContain("otomat-vps is not connected yet.");
});

it("keeps a pending revocation visible after the key is forgotten", async () => {
  const container = await renderPanel([
    {
      connection_id: "c-otomat",
      hosts: [
        { host_id: "local", label: "Local", state: "cleared", detail: null },
        {
          host_id: "remote",
          label: "otomat-vps",
          state: "pending_revocation",
          detail: "otomat-vps is not connected yet.",
        },
      ],
    },
  ]);

  expect(container.textContent).toContain("Waiting to revoke the key");
});

it("reads only its own connection's hosts", async () => {
  const container = await renderPanel(
    [
      {
        connection_id: "c-otomat",
        hosts: [CONNECTED_LOCAL],
      },
      {
        connection_id: "c-crm",
        hosts: [
          {
            host_id: "remote",
            label: "otomat-vps",
            state: "pending_restore",
            detail: "otomat-vps is not connected yet.",
          },
        ],
      },
    ],
    "c-otomat",
  );

  expect(container.textContent).toContain("Local");
  expect(container.textContent).not.toContain("otomat-vps");
});

it("stays out of the way for a connection the vault does not know", async () => {
  const container = await renderPanel([], "c-otomat");

  expect(container.textContent).toBe("");
});
