// @vitest-environment happy-dom
import { IntegrationsSection } from "@web/components/settings/integrations/section";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery, type Mounted } from "#support/mount";

let connectionState: Record<string, unknown>;

vi.mock("@web/api/linear/queries", () => ({
  useLinearConnection: () => connectionState,
}));

vi.mock("@web/api/linear/mutations", () => ({
  useDisconnectLinear: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@web/components/settings/integrations/linear-connect-form", () => ({
  LinearConnectForm: ({ connectionError }: { connectionError: string | null }) => (
    <div data-testid="linear-connect-form" data-connection-error={connectionError ?? ""} />
  ),
}));

vi.mock("@web/components/settings/integrations/onboarding-panel", () => ({
  LinearOnboardingPanel: ({ workspaceId }: { workspaceId: string }) => (
    <div data-testid="linear-onboarding" data-workspace-id={workspaceId} />
  ),
}));

let rendered: Mounted | null = null;

beforeEach(() => {
  connectionState = {
    data: {
      status: "connected",
      workspace_id: "workspace-1",
      workspace_name: "Otomat",
      user_name: "Alim",
      error_code: null,
      error_message: null,
    },
    isPending: false,
    isError: false,
    isSuccess: true,
  };
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

it("shows the connected workspace identity", async () => {
  const container = await renderSection();

  expect(container.textContent).toContain("Connected as Alim");
});

it("asks what a connected workspace still needs before an issue can appear", async () => {
  const container = await renderSection();

  const onboarding = container.querySelector("[data-testid='linear-onboarding']");
  expect(onboarding?.getAttribute("data-workspace-id")).toBe("workspace-1");
});

it("keeps the onboarding path out of the way while nothing is connected", async () => {
  connectionState = {
    data: {
      status: "disconnected",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: null,
      error_message: null,
    },
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderSection();

  expect(container.querySelector("[data-testid='linear-onboarding']")).toBeNull();
});

it("does not render stale connection controls after a background connection error", async () => {
  connectionState = { ...connectionState, isError: true, isSuccess: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Could not read the Linear connection.");
  expect(container.textContent).not.toContain("Connected as");
});

it("manages Linear from a project on the remote host too", async () => {
  window.otomat = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  connectionState = {
    data: {
      status: "disconnected",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: null,
      error_message: null,
    },
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderSection();

  expect(container.querySelector("[data-testid='linear-connect-form']")).not.toBeNull();
  expect(container.textContent).not.toContain("local daemon only");
});

it("delegates a failed connection message to the connection form", async () => {
  connectionState = {
    data: {
      status: "failed",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: "linear_unauthorized",
      error_message: "Linear rejected the API key.",
    },
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderSection();

  expect(
    container
      .querySelector("[data-testid='linear-connect-form']")
      ?.getAttribute("data-connection-error"),
  ).toBe("Linear rejected the API key.");
  expect(container.querySelector("[role='alert']")).toBeNull();
});
