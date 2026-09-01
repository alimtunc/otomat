// @vitest-environment happy-dom
import type {
  AgentProfileContract,
  ProjectContract,
  RuntimeDescriptor,
  SkillContract,
} from "@otomat/domain";
import { ProjectAgentsSection } from "@web/components/settings/project/agents-section";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { agentProfile, runtimeDescriptor, skillContract } from "#support/agent";
import { mountWithQuery, type Mounted } from "#support/mount";

let profiles: AgentProfileContract[] = [];
let projects: ProjectContract[] = [];
const runtimes: RuntimeDescriptor[] = [runtimeDescriptor({ id: "claude" })];
let skills: SkillContract[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => () => undefined,
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    listAgentProfiles: async () => profiles,
    listProjects: async () => projects,
    listRuntimes: async () => runtimes,
    listSkills: async () => skills,
  },
}));

const cleanups: Array<() => Promise<void>> = [];

const project = (id: string): ProjectContract => ({
  id,
  name: id,
  root_path: `/repo/${id}`,
  has_repository: true,
});

beforeEach(() => {
  projects = [project("proj-1")];
  skills = [skillContract({ id: "crm", project_id: "proj-1", name: "CRM" })];
  profiles = [];
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function renderSection(): Promise<Mounted> {
  const mounted = await mountWithQuery(<ProjectAgentsSection />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("keeps the listing to the selected project's own agents", async () => {
  profiles = [
    agentProfile({ id: "own", name: "Project reviewer", project_id: "proj-1", runtime: "claude" }),
    agentProfile({ id: "global", name: "Global reviewer", runtime: "claude" }),
  ];
  const { container } = await renderSection();

  expect(container.textContent).toContain("Project reviewer");
  expect(container.textContent).not.toContain("Global reviewer");
});

it("reports a project agent as launchable on its own project's skill", async () => {
  profiles = [
    agentProfile({ id: "own", project_id: "proj-1", runtime: "claude", skill_ids: ["crm"] }),
  ];
  const { container } = await renderSection();

  expect(container.textContent).toContain("Available on the local host");
});

it("asks for a repository instead of an empty agent list when no project is selected", async () => {
  projects = [];
  const { container } = await renderSection();

  expect(container.textContent).toContain("No project selected");
});
