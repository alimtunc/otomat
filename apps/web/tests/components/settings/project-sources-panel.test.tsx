// @vitest-environment happy-dom
import type { LinearDeliverySnapshot, ProjectContract } from "@otomat/domain";
import { ProjectSourcesPanel } from "@web/components/settings/project/sources-panel";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { findRefreshButton } from "#support/dom-queries";
import type { FakeQueryState } from "#support/fake-query";
import { linearConnection as connection } from "#support/linear";
import { mount, type Mounted } from "#support/mount";

let connectionsState: FakeQueryState;
let sourcesState: FakeQueryState;
let sourcesScope: unknown[];
let workspaceScope: unknown[];
let workspaceState: FakeQueryState;
let delivery: LinearDeliverySnapshot | null;
let syncSources: number;
const syncRefresh = vi.fn();
const createdCallbacks: (() => void)[] = [];

const PROJECT: ProjectContract = { id: "p1", name: "Otomat", root_path: "/tmp/otomat" };

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#link">{children}</a>,
}));

vi.mock("@web/api/linear/queries", () => ({
  useIssueSources: (...args: unknown[]) => {
    sourcesScope = args;
    return sourcesState;
  },
  useLinearConnections: () => connectionsState,
  useLinearWorkspace: (...args: unknown[]) => {
    workspaceScope = args;
    return workspaceState;
  },
}));

vi.mock("@web/api/linear/use-delivery", () => ({ useLinearDelivery: () => delivery }));

const updateSource = vi.fn();

vi.mock("@web/api/linear/mutations", () => ({
  useDeleteIssueSource: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  useReconcileIssueSource: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  useUpdateIssueSource: () => ({ isPending: false, mutate: updateSource, variables: undefined }),
}));

vi.mock("@web/api/linear/use-project-sync", () => ({
  useProjectLinearSync: (projectId: string | undefined) => ({
    status: {
      project_id: projectId ?? "",
      sources: syncSources,
      connection: null,
      running: false,
      last_synced_at: null,
      last_result: null,
      last_error: null,
    },
    running: false,
    refresh: syncRefresh,
    refreshIfStale: vi.fn(),
  }),
}));

vi.mock("@web/components/settings/integrations/issue-source-form", () => ({
  IssueSourceForm: ({
    connectionId,
    onCreated,
  }: {
    connectionId: string;
    onCreated?: () => void;
  }) => {
    if (onCreated !== undefined) createdCallbacks.push(onCreated);
    return <div data-testid="issue-source-form" data-connection-id={connectionId} />;
  },
}));

let rendered: Mounted | null = null;

beforeEach(() => {
  syncRefresh.mockClear();
  updateSource.mockClear();
  createdCallbacks.length = 0;
  syncSources = 1;
  sourcesScope = [];
  workspaceScope = [];
  delivery = null;
  connectionsState = {
    data: [connection()],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  sourcesState = {
    data: [
      {
        id: "source-1",
        project_id: "p1",
        connection_id: "c-otomat",
        source: "linear",
        external_team_id: "team-1",
        external_team_key: "OTO",
        external_team_name: "Otomat",
        external_project_id: "",
        external_project_name: "",
        last_synced_at: null,
        lifecycle: { in_progress: null, done: null },
        lifecycle_error: null,
      },
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  workspaceState = {
    data: {
      teams: [
        {
          id: "team-1",
          key: "OTO",
          name: "Otomat",
          states: [{ id: "s-doing", name: "Doing", type: "started" }],
        },
      ],
      projects: [],
    },
    isPending: false,
    isError: false,
  };
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
});

async function renderPanel(): Promise<HTMLElement> {
  rendered = await mount(<ProjectSourcesPanel project={PROJECT} />);
  return rendered.container;
}

it("asks the daemon for this project's sources alone, with an unmap action", async () => {
  const container = await renderPanel();

  expect(sourcesScope).toEqual(["p1"]);
  expect(container.textContent).toContain("OTO");
  const unmap = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Unmap",
  );
  expect(unmap).toBeDefined();
});

it("reads the workspace of the connection this project already maps", async () => {
  connectionsState = {
    data: [connection({ id: "c-crm", label: "CRM" }), connection()],
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderPanel();

  expect(workspaceScope).toEqual(["c-otomat"]);
  expect(
    container
      .querySelector("[data-testid='issue-source-form']")
      ?.getAttribute("data-connection-id"),
  ).toBe("c-otomat");
});

it("offers the source's own Linear statuses for the run and merge phases", async () => {
  const container = await renderPanel();

  const labels = [...container.querySelectorAll("[aria-label]")].map((node) =>
    node.getAttribute("aria-label"),
  );
  expect(labels).toContain("Run started");
  expect(labels).toContain("Pull request merged");
});

it("says so instead of guessing when the team's statuses are unavailable", async () => {
  workspaceState = { data: undefined, isPending: true, isError: false };

  const container = await renderPanel();

  expect(container.textContent).toContain("run mapping cannot be changed");
  expect(updateSource).not.toHaveBeenCalled();
});

it("syncs only this project's sources", async () => {
  const container = await renderPanel();
  findRefreshButton(container)?.click();

  expect(syncRefresh).toHaveBeenCalledWith({ announce: true });
});

it("offers no refresh while the project maps nothing", async () => {
  sourcesState = { data: [], isPending: false, isError: false, isSuccess: true };
  syncSources = 0;

  const container = await renderPanel();

  expect(findRefreshButton(container)).toBeNull();
});

it("starts the first import as soon as a mapping is saved", async () => {
  await renderPanel();

  expect(createdCallbacks).toHaveLength(1);
  createdCallbacks[0]?.();

  expect(syncRefresh).toHaveBeenCalledWith({ announce: true });
});

it("explains when the connected Linear workspace has no teams", async () => {
  workspaceState = { data: { teams: [], projects: [] }, isPending: false, isError: false };

  const container = await renderPanel();

  expect(container.textContent).toContain("no teams available to map");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("points at global Integrations while no connection exists", async () => {
  connectionsState = { data: [], isPending: false, isError: false, isSuccess: true };

  const container = await renderPanel();

  expect(container.textContent).toContain("Connect a Linear workspace in");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("names the host still waiting for the key instead of inviting a connection that exists", async () => {
  connectionsState = {
    data: [connection({ status: "disconnected" })],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  delivery = {
    connections: [
      {
        connection_id: "c-otomat",
        hosts: [
          {
            host_id: "local",
            label: "Local",
            state: "pending_restore",
            detail: "The local daemon is not running yet.",
          },
        ],
      },
    ],
  };

  const container = await renderPanel();

  expect(container.textContent).toContain("Local has not received Otomat's key yet");
  expect(container.textContent).toContain("The local daemon is not running yet.");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("says a revoked connection lost its access rather than blaming the host", async () => {
  connectionsState = {
    data: [
      connection({
        status: "failed",
        error_code: "linear_unauthorized",
        error_message: "Linear rejected the API key.",
      }),
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderPanel();

  expect(container.textContent).toContain("lost its access");
  expect(container.textContent).toContain("Linear rejected the API key.");
});

it("says so when this project maps a connection the host does not know", async () => {
  connectionsState = {
    data: [connection({ id: "c-crm", label: "CRM" })],
    isPending: false,
    isError: false,
    isSuccess: true,
  };

  const container = await renderPanel();

  expect(container.textContent).toContain("maps a Linear connection this host does not know");
});
