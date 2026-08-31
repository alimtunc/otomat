// @vitest-environment happy-dom
import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { AgentProfileDetail } from "@web/components/agents/agent-profile/detail/content";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mountWithQuery, type Mounted } from "#support/mount";
import { providerOptionSet } from "#support/runtime-options";

let alias: string | null = null;
let hostActive = false;
let catalog: SkillContract[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => () => undefined,
}));

vi.mock("@web/components/shell/remote-session/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRemoteSession: () => ({ alias, active: hostActive }),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    listSkills: async () => catalog,
    runtimeProviderOptions: async () => providerOptionSet(),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  alias = null;
  hostActive = false;
  catalog = [];
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

function profile(overrides: Partial<AgentProfileContract> = {}): AgentProfileContract {
  return {
    id: "profile-1",
    name: "Reviewer",
    runtime: "claude",
    options: {},
    model: null,
    guidance: "Read the diff before answering.",
    skill_ids: [],
    compatibility: null,
    ...overrides,
  };
}

function claude(overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor {
  return {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      permissions: true,
      diff_hints: true,
    },
    availability: { status: "available", version: "1.0.0" },
    ...overrides,
  };
}

function skill(overrides: Partial<SkillContract> = {}): SkillContract {
  return {
    id: "skill-review",
    source: "project",
    canonical_path: "/repo/.agents/skills/review/SKILL.md",
    name: "Review",
    description: "Review a diff",
    content_hash: "abc",
    status: "available",
    invalid_reason: null,
    enabled: true,
    ...overrides,
  };
}

async function renderDetail(
  agentProfile: AgentProfileContract,
  descriptors: RuntimeDescriptor[] = [claude()],
): Promise<Mounted> {
  const mounted = await mountWithQuery(
    <AgentProfileDetail profile={agentProfile} descriptors={descriptors} />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("shows the profile's own runtime, instructions and skills", async () => {
  catalog = [skill()];
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }));

  expect(container.textContent).toContain("Reviewer");
  expect(container.textContent).toContain("Claude Code");
  expect(container.querySelector("textarea")?.value).toBe("Read the diff before answering.");
  expect(container.textContent).toContain("Review");
  expect(container.textContent).toContain("/repo/.agents/skills/review/SKILL.md");
  expect(container.textContent).toContain("Available on the local host");
});

it("says a profile has no skill rather than implying one", async () => {
  catalog = [skill()];
  const { container } = await renderDetail(profile());

  expect(container.textContent).toContain("No activated skills");
});

it("flags a configured skill the host cannot offer, without dropping it", async () => {
  catalog = [];
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }));

  expect(container.textContent).toContain("skill-review");
  expect(container.textContent).toContain("Not found on the local host");
});

it("names the remote host a catalog was read on once the session moves there", async () => {
  alias = "otomat-vps";
  hostActive = true;
  catalog = [skill({ enabled: false })];
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }));

  expect(container.textContent).toContain("Available on otomat-vps");
  expect(container.textContent).toContain("Disabled in the skill catalog");
});

it("keeps a merely configured remote host out of a catalog the local daemon answered", async () => {
  alias = "otomat-vps";
  catalog = [skill()];
  const { container } = await renderDetail(profile({ skill_ids: ["skill-review"] }));

  expect(container.textContent).not.toContain("otomat-vps");
  expect(container.textContent).toContain("Available on the local host");
});

it("refuses a profile whose runtime is here but whose skill is not", async () => {
  const { container } = await renderDetail(
    profile({
      compatibility: { error: "skill_unavailable", message: 'skill "Review" is disabled' },
    }),
  );

  expect(container.textContent).toContain("cannot be selected on the local host");
  expect(container.textContent).toContain('skill "Review" is disabled');
});

it("makes a capability this host is missing actionable instead of hiding the profile", async () => {
  const { container } = await renderDetail(
    profile({
      compatibility: { error: "runtime_unavailable", message: "claude is not installed here" },
    }),
    [claude({ availability: { status: "unavailable", reason: "binary_not_found" } })],
  );

  expect(container.textContent).toContain("CLI not found on the local host");
  expect(container.textContent).toContain("cannot be selected on the local host");
  expect(container.textContent).toContain("claude is not installed here");
  const runtimesLink = [...container.querySelectorAll("a")].find((link) =>
    link.textContent?.includes("Runtimes"),
  );
  expect(runtimesLink?.getAttribute("href")).toBe("/settings/runtimes");
});
