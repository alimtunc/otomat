// @vitest-environment happy-dom
import type { ProjectContract } from "@otomat/domain";
import { ProjectSourcesPanel } from "@web/components/settings/project/sources-panel";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

let connectionState: Record<string, unknown>;
let sourcesState: Record<string, unknown>;
let workspaceState: Record<string, unknown>;
const syncMutate = vi.fn();

const PROJECT: ProjectContract = { id: "p1", name: "Otomat", root_path: "/tmp/otomat" };

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: unknown }) => <a href="#link">{children as never}</a>,
}));

vi.mock("@web/api/linear/queries", () => ({
  useIssueSources: () => sourcesState,
  useLinearConnection: () => connectionState,
  useLinearWorkspace: () => workspaceState,
}));

vi.mock("@web/api/linear/mutations", () => ({
  useDeleteIssueSource: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  useSyncLinear: () => ({ isPending: false, mutate: syncMutate }),
}));

vi.mock("@web/components/settings/integrations/issue-source-form", () => ({
  IssueSourceForm: () => <div data-testid="issue-source-form" />,
}));

let rendered: Mounted | null = null;

beforeEach(() => {
  syncMutate.mockClear();
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
  sourcesState = {
    data: [
      {
        id: "source-1",
        project_id: "p1",
        source: "linear",
        external_team_id: "team-1",
        external_team_key: "OTO",
        external_team_name: "Otomat",
        external_project_id: "",
        external_project_name: "",
        last_synced_at: null,
      },
      {
        id: "source-2",
        project_id: "p2",
        source: "linear",
        external_team_id: "team-2",
        external_team_key: "ENG",
        external_team_name: "Engineering",
        external_project_id: "",
        external_project_name: "",
        last_synced_at: null,
      },
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  workspaceState = {
    data: { teams: [{ id: "team-1", key: "OTO", name: "Otomat" }], projects: [] },
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

it("lists only the selected project's sources, with an unmap action", async () => {
  const container = await renderPanel();

  expect(container.textContent).toContain("OTO");
  expect(container.textContent).not.toContain("ENG");
  const unmap = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Unmap",
  );
  expect(unmap).toBeDefined();
});

it("syncs only this project's sources", async () => {
  const container = await renderPanel();
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Sync this project",
  );
  button?.click();

  expect(syncMutate).toHaveBeenCalledWith({ project_id: "p1" });
});

it("disables sync when the project has no mapped sources", async () => {
  sourcesState = { data: [], isPending: false, isError: false, isSuccess: true };

  const container = await renderPanel();
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Sync this project",
  );

  expect(button?.disabled).toBe(true);
});

it("mounts the mapping form pinned to the selected project", async () => {
  const container = await renderPanel();

  expect(container.querySelector("[data-testid='issue-source-form']")).not.toBeNull();
});

it("explains when the connected Linear workspace has no teams", async () => {
  workspaceState = { data: { teams: [], projects: [] }, isPending: false, isError: false };

  const container = await renderPanel();

  expect(container.textContent).toContain("no teams available to map");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});

it("points at global Integrations while Linear is disconnected", async () => {
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

  const container = await renderPanel();

  expect(container.textContent).toContain("Connect Linear");
  expect(container.querySelector("[data-testid='issue-source-form']")).toBeNull();
});
