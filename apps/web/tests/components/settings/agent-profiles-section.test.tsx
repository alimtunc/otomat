// @vitest-environment happy-dom
import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { AgentProfilesSection } from "@web/components/agents/agent-profile/list/section";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { agentProfile, runtimeDescriptor, skillContract } from "#support/agent";
import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

let profiles: AgentProfileContract[] = [];
let runtimes: RuntimeDescriptor[] = [];
let skills: SkillContract[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    children?: ReactNode;
  }) => <a href={to.replace(/\$(\w+)/g, (_, key: string) => params?.[key] ?? "")}>{children}</a>,
  useNavigate: () => () => undefined,
  useSearch: () => ({ filter: undefined }),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    listAgentProfiles: async () => profiles,
    listRuntimes: async () => runtimes,
    listSkills: async () => skills,
  },
}));

const cleanups: Array<() => Promise<void>> = [];

const claude = (overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor =>
  runtimeDescriptor({ id: "claude", display_name: "Claude Code", ...overrides });

const profile = (overrides: Partial<AgentProfileContract> = {}): AgentProfileContract =>
  agentProfile({
    id: "profile-1",
    name: "Reviewer",
    runtime: "claude",
    guidance: "Read the diff before answering.",
    skill_ids: ["skill-review"],
    ...overrides,
  });

beforeEach(() => {
  profiles = [];
  runtimes = [claude()];
  skills = [skillContract({ id: "skill-review" })];
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function renderSection(): Promise<Mounted> {
  const mounted = await mountWithQuery(<AgentProfilesSection />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("lists the profiles the user defined, with their instructions and skill count", async () => {
  profiles = [profile()];
  const { container } = await renderSection();

  expect(container.textContent).toContain("Reviewer");
  expect(container.textContent).toContain("Read the diff before answering.");
  expect(container.textContent).toContain("Claude Code");
  const link = [...container.querySelectorAll("a")].find((anchor) =>
    anchor.textContent?.includes("Reviewer"),
  );
  expect(link?.getAttribute("href")).toBe("/settings/agents/profile-1");
});

it("offers a first profile, naming the host whose catalog is the empty one", async () => {
  const { container } = await renderSection();

  expect(container.textContent).toContain("No agent profile on Local yet");
  expect(findButton("New profile")).toBeDefined();
});

it("marks a profile whose runtime this host does not offer", async () => {
  profiles = [profile()];
  runtimes = [claude({ availability: { status: "unavailable", reason: "binary_not_found" } })];
  const { container } = await renderSection();

  expect(container.textContent).toContain("CLI not found on the local host");
});

it("marks a global profile whose skill belongs to a project", async () => {
  profiles = [profile()];
  skills = [skillContract({ id: "skill-review", project_id: "proj-1", name: "CRM" })];
  const { container } = await renderSection();

  expect(container.textContent).toContain("Skill “CRM”: Belongs to another project");
});
