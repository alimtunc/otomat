// @vitest-environment happy-dom
import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { AgentProfileDetail } from "@web/components/agents/agent-profile/detail/content";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { agentProfile, runtimeDescriptor, skillContract } from "#support/agent";
import { mountWithQuery, type Mounted } from "#support/mount";
import { providerOptionSet } from "#support/runtime-options";

let alias: string | null = null;
let hostActive = false;

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => () => undefined,
}));

vi.mock("@web/components/shell/remote-session/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRemoteSession: () => ({ alias, active: hostActive }),
}));

vi.mock("@web/api/client", () => ({
  daemon: { runtimeProviderOptions: async () => providerOptionSet() },
}));

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  alias = null;
  hostActive = false;
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

const profile = (overrides: Partial<AgentProfileContract> = {}): AgentProfileContract =>
  agentProfile({
    id: "profile-1",
    name: "Reviewer",
    project_id: "project-1",
    runtime: "claude",
    guidance: "Read the diff before answering.",
    ...overrides,
  });

const claude = (overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor =>
  runtimeDescriptor({ id: "claude", display_name: "Claude Code", ...overrides });

const skill = (overrides: Partial<SkillContract> = {}): SkillContract =>
  skillContract({
    id: "skill-review",
    project_id: "project-1",
    canonical_path: "/repo/.agents/skills/review/SKILL.md",
    name: "Review",
    ...overrides,
  });

async function renderDetail(
  subject: AgentProfileContract,
  catalog: SkillContract[] = [],
  descriptors: RuntimeDescriptor[] = [claude()],
): Promise<Mounted> {
  const mounted = await mountWithQuery(
    <AgentProfileDetail profile={subject} descriptors={descriptors} skills={catalog} />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("shows the profile's own runtime, instructions and skills", async () => {
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }), [skill()]);

  expect(container.textContent).toContain("Reviewer");
  expect(container.textContent).toContain("Claude Code");
  expect(container.querySelector("textarea")?.value).toBe("Read the diff before answering.");
  expect(container.textContent).toContain("Review");
  expect(container.textContent).toContain("/repo/.agents/skills/review/SKILL.md");
  expect(container.textContent).toContain("Available on the local host");
});

it("says a profile has no skill rather than implying one", async () => {
  const { container } = await renderDetail(profile(), [skill()]);

  expect(container.textContent).toContain("No activated skills");
});

it("flags a configured skill the host cannot offer, without dropping it", async () => {
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }), []);

  expect(container.textContent).toContain("skill-review");
  expect(container.textContent).toContain("Not found on the local host");
});

it("names the remote host a catalog was read on once the session moves there", async () => {
  alias = "otomat-vps";
  hostActive = true;
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }), []);

  expect(container.textContent).toContain("A configured skill: Not found on otomat-vps");
});

it("names the skill a disabled catalog entry blocks, without blaming the host", async () => {
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }), [
    skill({ enabled: false }),
  ]);

  expect(container.textContent).toContain("Skill “Review”: Disabled in the skill catalog");
});

it("keeps a merely configured remote host out of a catalog the local daemon answered", async () => {
  alias = "otomat-vps";
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }), [skill()]);

  expect(container.textContent).not.toContain("otomat-vps");
  expect(container.textContent).toContain("Available on the local host");
});

it("makes an unavailable runtime actionable instead of hiding the profile", async () => {
  const { container } = await renderDetail(
    profile(),
    [],
    [claude({ availability: { status: "unavailable", reason: "binary_not_found" } })],
  );

  expect(container.textContent).toContain("CLI not found on the local host");
  expect(container.textContent).toContain("cannot be selected on the local host");
  const runtimesLink = [...container.querySelectorAll("a")].find((link) =>
    link.textContent?.includes("Runtimes"),
  );
  expect(runtimesLink?.getAttribute("href")).toBe("/settings/runtimes");
});

it("refuses a project skill to a global profile and says so on the badge", async () => {
  const { container } = await renderDetail(
    profile({ project_id: null, skill_ids: ["skill-review"] }),
    [skill()],
  );

  expect(container.textContent).toContain("Global");
  expect(container.textContent).toContain("Skill “Review”: Belongs to another project");
});

it("offers a project agent its own project's skills, and never another project's", async () => {
  const { container } = await renderDetail(profile(), [
    skill(),
    skill({
      id: "skill-foreign",
      name: "Foreign",
      description: "Another repository's own",
      project_id: "project-2",
    }),
  ]);

  expect(container.textContent).toContain("Review a diff");
  expect(container.textContent).not.toContain("Another repository's own");
});
