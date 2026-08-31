// @vitest-environment happy-dom
import type { LinearConnectionContract } from "@otomat/domain";
import { IntegrationsSection } from "@web/components/settings/integrations/section";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import type { FakeQueryState } from "#support/fake-query";
import { linearConnection as connection } from "#support/linear";
import { mountWithQuery, type Mounted } from "#support/mount";

let connectionsState: FakeQueryState;

vi.mock("@web/api/linear/queries", () => ({
  useLinearConnections: () => connectionsState,
  useIssueSources: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useProjects: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/linear/mutations", () => ({
  useDisconnectLinear: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@web/components/settings/integrations/linear/connect-form", () => ({
  LinearConnectForm: (props: { connection?: LinearConnectionContract | null }) => (
    <div data-testid="linear-connect-form" data-connection-id={props.connection?.id ?? ""} />
  ),
}));

vi.mock("@web/components/settings/integrations/onboarding-panel", () => ({
  LinearOnboardingPanel: () => <div data-testid="linear-onboarding" />,
}));

function loaded(connections: LinearConnectionContract[]): FakeQueryState {
  return { data: connections, isPending: false, isError: false, isSuccess: true };
}

let rendered: Mounted | null = null;

beforeEach(() => {
  connectionsState = loaded([connection()]);
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  delete window.otomat;
  document.body.replaceChildren();
});

async function renderSection(): Promise<HTMLElement> {
  rendered = await mountWithQuery(<IntegrationsSection />);
  return rendered.container;
}

it("lists each connection with its workspace identity", async () => {
  connectionsState = loaded([
    connection(),
    connection({ id: "c-crm", label: "CRM", workspace_name: "Avest", user_name: "Alim" }),
  ]);

  const container = await renderSection();

  expect(container.textContent).toContain("Otomat");
  expect(container.textContent).toContain("CRM");
  expect(container.textContent).toContain("Avest · Alim");
});

it("invites a first connection when the catalogue is empty", async () => {
  connectionsState = loaded([]);

  const container = await renderSection();

  expect(container.textContent).toContain("No Linear connection yet");
  expect(container.querySelector("[data-testid='linear-connect-form']")).not.toBeNull();
});

it("does not render stale connection controls after a background read error", async () => {
  connectionsState = { ...connectionsState, isError: true, isSuccess: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Could not read the Linear connections.");
  expect(container.textContent).not.toContain("Otomat");
});

it("manages Linear from a project on the remote host too", async () => {
  window.otomat = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  connectionsState = loaded([]);

  const container = await renderSection();

  expect(container.querySelector("[data-testid='linear-connect-form']")).not.toBeNull();
  expect(container.textContent).not.toContain("local daemon only");
});

it("says a connection lost its access instead of showing it as usable", async () => {
  connectionsState = loaded([
    connection({
      status: "failed",
      error_code: "linear_unauthorized",
      error_message: "Linear rejected the API key.",
    }),
  ]);

  const container = await renderSection();

  expect(container.textContent).toContain("Linear rejected the API key.");
});

it("says the key never reached this host rather than claiming a live connection", async () => {
  connectionsState = loaded([connection({ status: "disconnected" })]);

  const container = await renderSection();

  expect(container.textContent).toContain("Key not on this host");
});
