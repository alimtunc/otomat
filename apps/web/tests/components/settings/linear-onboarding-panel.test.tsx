// @vitest-environment happy-dom
import type { IssueSourceContract, ProjectContract } from "@otomat/domain";
import { LinearOnboardingPanel } from "@web/components/settings/integrations/onboarding-panel";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

let projects: ProjectContract[];
let sources: IssueSourceContract[];
const selectProject = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: unknown; to?: string }) => (
    <a href={to}>{children as never}</a>
  ),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useProjects: () => ({ data: projects, isSuccess: true }),
}));

vi.mock("@web/api/linear/queries", () => ({
  useIssueSources: () => ({ data: sources, isSuccess: true }),
}));

vi.mock("@web/components/shell/project-selection/use-project-switcher", () => ({
  useProjectSwitcher: () => ({
    hostOptions: [{ id: "local", label: "Local", active: true }],
    selectProject,
  }),
}));

vi.mock("@web/components/shell/project-selection/add-project-dialog", () => ({
  AddProjectDialog: ({ open }: { open: boolean }) => (
    <div data-testid="add-project-dialog" data-open={String(open)} />
  ),
}));

function project(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return { id: "p1", name: "Otomat", root_path: "/tmp/otomat", has_repository: true, ...overrides };
}

function source(projectId: string): IssueSourceContract {
  return {
    id: "src-1",
    project_id: projectId,
    source: "linear",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    external_project_id: "",
    external_project_name: "",
    last_synced_at: null,
  };
}

let rendered: Mounted | null = null;

async function renderPanel(): Promise<HTMLElement> {
  rendered = await mount(<LinearOnboardingPanel workspaceId="workspace-1" />);
  return rendered.container;
}

function dialogOpen(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-testid='add-project-dialog']")?.getAttribute("data-open");
}

beforeEach(() => {
  projects = [project()];
  sources = [];
  selectProject.mockClear();
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
});

it("explains that this host has no project and opens the creation path", async () => {
  projects = [];

  const container = await renderPanel();

  expect(container.textContent).toContain("No project on this host yet");
  const add = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Add project",
  );
  expect(add).toBeDefined();
  expect(dialogOpen(container)).toBe("false");
  add?.click();

  await vi.waitFor(() => expect(dialogOpen(container)).toBe("true"));
});

it("leads an unmapped project to the per-project association instead of stopping at Connected", async () => {
  const container = await renderPanel();

  expect(container.textContent).toContain("No Linear team mapped yet");
  expect(container.textContent).toContain("never guesses");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/settings/project");
});

it("ignores a project the active host cannot select", async () => {
  projects = [project({ has_repository: false })];

  const container = await renderPanel();

  expect(container.textContent).toContain("No project on this host yet");
});

it("steps aside once a mapping exists", async () => {
  sources = [source("p1")];

  const container = await renderPanel();

  expect(container.textContent).toBe("");
});

it("does not count another host's mapping as this host's", async () => {
  sources = [source("vps-project")];

  const container = await renderPanel();

  expect(container.textContent).toContain("No Linear team mapped yet");
});
