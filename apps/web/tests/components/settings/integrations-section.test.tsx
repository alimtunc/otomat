// @vitest-environment happy-dom
import { IntegrationsSection } from "@web/components/settings/integrations/section";
import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

let connectionState: Record<string, unknown>;
let projectsState: Record<string, unknown>;
let sourcesState: Record<string, unknown>;
let workspaceState: Record<string, unknown>;
let issueSourceFormInstances = 0;

vi.mock("@web/api/daemon/queries", () => ({
  useProjects: () => projectsState,
}));

vi.mock("@web/api/linear/queries", () => ({
  useIssueSources: () => sourcesState,
  useLinearConnection: () => connectionState,
  useLinearWorkspace: () => workspaceState,
}));

vi.mock("@web/api/linear/mutations", () => ({
  useDisconnectLinear: () => ({ isPending: false, mutate: vi.fn() }),
  useSyncLinear: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@web/components/settings/integrations/issue-source-form", () => ({
  IssueSourceForm: () => {
    const [instance] = useState(() => (issueSourceFormInstances += 1));
    return <div data-testid="issue-source-form" data-instance={instance} />;
  },
}));

vi.mock("@web/components/settings/integrations/issue-sources-list", () => ({
  IssueSourcesList: () => <div data-testid="issue-sources-list" />,
}));

vi.mock("@web/components/settings/integrations/linear-connect-form", () => ({
  LinearConnectForm: ({ connectionError }: { connectionError: string | null }) => (
    <div data-testid="linear-connect-form" data-connection-error={connectionError ?? ""} />
  ),
}));

let rendered: Mounted | null = null;

beforeEach(() => {
  issueSourceFormInstances = 0;
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
  projectsState = {
    data: [{ id: "p1", name: "Otomat", root_path: "/tmp/otomat" }],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  sourcesState = { data: [{ id: "source-1" }], isPending: false, isError: false, isSuccess: true };
  workspaceState = {
    data: {
      teams: [{ id: "team-1", key: "OTO", name: "Otomat" }],
      projects: [],
    },
    isPending: false,
    isError: false,
  };
});

function RefreshableSection() {
  const [, setRevision] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setRevision((revision) => revision + 1)}>
        Refresh
      </button>
      <IntegrationsSection />
    </>
  );
}

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
});

async function renderSection(): Promise<HTMLElement> {
  rendered = await mount(<IntegrationsSection />);
  return rendered.container;
}

it("shows a loading placeholder while the Linear workspace loads", async () => {
  workspaceState = { data: undefined, isPending: true, isError: false };

  const container = await renderSection();

  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("explains when the connected Linear workspace has no teams", async () => {
  workspaceState = { data: { teams: [], projects: [] }, isPending: false, isError: false };

  const container = await renderSection();

  expect(container.textContent).toContain("no teams available to map");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("requires a local project before mounting the mapping form", async () => {
  projectsState = { data: [], isPending: false, isError: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Register a repository first");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("mounts the mapping form when both sides have a selectable target", async () => {
  const container = await renderSection();

  expect(container.querySelector("[data-testid='issue-source-form']")).not.toBeNull();
});

it("resets mapping form state when the connected workspace changes", async () => {
  connectionState = {
    ...connectionState,
    data: {
      status: "connected",
      workspace_id: "disconnected",
      workspace_name: "Sentinel collision workspace",
      user_name: "Alim",
      error_code: null,
      error_message: null,
    },
  };
  rendered = await mount(<RefreshableSection />);
  const form = rendered.container.querySelector("[data-testid='issue-source-form']");
  const firstInstance = form?.getAttribute("data-instance");

  connectionState = {
    ...connectionState,
    data: {
      status: "connected",
      workspace_id: "workspace-2",
      workspace_name: "Second workspace",
      user_name: "Alim",
      error_code: null,
      error_message: null,
    },
  };
  await act(async () => {
    rendered?.container.querySelector("button")?.click();
  });

  expect(
    rendered.container
      .querySelector("[data-testid='issue-source-form']")
      ?.getAttribute("data-instance"),
  ).not.toBe(firstInstance);
});

it("does not render stale connection controls after a background connection error", async () => {
  connectionState = { ...connectionState, isError: true, isSuccess: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Could not read the Linear connection.");
  expect(container.textContent).not.toContain("Connected as");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("does not render stale project controls after a background project error", async () => {
  projectsState = { ...projectsState, isError: true, isSuccess: false };

  const container = await renderSection();

  expect(container.textContent).toContain("Could not load local projects.");
  expect(container.querySelector("[data-testid='issue-sources-list']")).toBeNull();
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
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

it.each([
  ["loading", { data: undefined, isPending: true, isError: false, isSuccess: false }],
  ["failed", { data: undefined, isPending: false, isError: true, isSuccess: false }],
  ["empty", { data: [], isPending: false, isError: false, isSuccess: true }],
])("disables sync while mapped sources are %s", async (_state, query) => {
  sourcesState = query;

  const container = await renderSection();
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Sync now",
  );

  expect(button?.disabled).toBe(true);
});
