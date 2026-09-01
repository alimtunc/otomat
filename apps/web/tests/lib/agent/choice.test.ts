import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  agentChoiceToRequest,
  encodeProfileChoice,
  encodeRuntimeChoice,
  isUsableAgentChoice,
  requestForProfile,
  resolveAgentChoice,
} from "@web/lib/agent/choice";
import { expect, it } from "vitest";

import { agentProfile, runtimeDescriptor, skillContract } from "#support/agent";

const runtime = (
  id: string,
  available: boolean,
  kind: "real" | "simulated" = "real",
): RuntimeDescriptor =>
  runtimeDescriptor({
    id,
    display_name: id,
    kind,
    availability: available
      ? { status: "available", version: null }
      : { status: "unavailable", reason: "binary_not_found" },
  });

const profile = (
  id: string,
  runtimeId: string,
  overrides: Partial<AgentProfileContract> = {},
): AgentProfileContract => agentProfile({ id, name: id, runtime: runtimeId, ...overrides });

const projectSkill = skillContract({
  id: "crm",
  project_id: "proj-1",
  canonical_path: "/repo/.agents/skills/crm/SKILL.md",
  name: "CRM",
});

it("maps a profile choice to a profile_id request field", () => {
  expect(agentChoiceToRequest(encodeProfileChoice("p1"))).toEqual({ profile_id: "p1" });
});

it("round-trips the stored model and options through an unrelated profile edit", () => {
  const stored = {
    ...profile("p1", "claude"),
    model: "opus",
    options: { permission_mode: "acceptEdits" },
  };
  const request = requestForProfile(stored, { guidance: "tuned" });
  expect(request.project_id).toBeNull();
  expect(request.model).toBe("opus");
  expect(request.options).toEqual({ permission_mode: "acceptEdits" });
  expect(request.guidance).toBe("tuned");
});

it("maps a runtime choice to a runtime request field", () => {
  expect(agentChoiceToRequest(encodeRuntimeChoice("claude"))).toEqual({ runtime: "claude" });
});

it("maps a null (inherit) choice to no fields", () => {
  expect(agentChoiceToRequest(null)).toEqual({});
});

it("treats a profile whose runtime is unavailable as unusable", () => {
  const descriptors = [runtime("claude", false)];
  const profiles = [profile("p1", "claude")];
  expect(isUsableAgentChoice(encodeProfileChoice("p1"), profiles, descriptors, [])).toBe(false);
});

it("falls back to the first available real runtime when the preferred choice is unusable", () => {
  const descriptors = [runtime("fake", true, "simulated"), runtime("claude", true)];
  const resolved = resolveAgentChoice(encodeRuntimeChoice("missing"), [], descriptors, []);
  expect(resolved).toBe(encodeRuntimeChoice("claude"));
});

it("keeps a usable preferred choice", () => {
  const descriptors = [runtime("claude", true)];
  const profiles = [profile("p1", "claude")];
  expect(resolveAgentChoice(encodeProfileChoice("p1"), profiles, descriptors, [])).toBe(
    encodeProfileChoice("p1"),
  );
});

it("drops a global profile that depends on a project skill back to a runtime", () => {
  const descriptors = [runtime("claude", true)];
  const profiles = [profile("p1", "claude", { skill_ids: ["crm"] })];

  expect(
    isUsableAgentChoice(encodeProfileChoice("p1"), profiles, descriptors, [projectSkill]),
  ).toBe(false);
  expect(resolveAgentChoice(encodeProfileChoice("p1"), profiles, descriptors, [projectSkill])).toBe(
    encodeRuntimeChoice("claude"),
  );
});

it("keeps a project profile that activates its own project's skill", () => {
  const descriptors = [runtime("claude", true)];
  const profiles = [profile("p1", "claude", { project_id: "proj-1", skill_ids: ["crm"] })];

  expect(
    isUsableAgentChoice(encodeProfileChoice("p1"), profiles, descriptors, [projectSkill]),
  ).toBe(true);
});
