// @vitest-environment happy-dom
import { IntegrationsSection } from "@web/components/settings/integrations/section";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

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
  document.body.replaceChildren();
});

async function renderSection(): Promise<HTMLElement> {
  rendered = await mount(<IntegrationsSection />);
  return rendered.container;
}

it("shows the connected workspace identity", async () => {
  const container = await renderSection();

  expect(container.textContent).toContain("Connected as Alim");
});

it("does not render stale connection controls after a background connection error", async () => {
  connectionState = { ...connectionState, isError: true, isSuccess: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Could not read the Linear connection.");
  expect(container.textContent).not.toContain("Connected as");
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
