import {
  skillSource,
  type AgentProfileContract,
  type RuntimeDescriptor,
  type SkillContract,
} from "@otomat/domain";

export function runtimeDescriptor(overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor {
  return {
    id: "fake",
    display_name: "Fake",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      interactions: { status: "unsupported", reason: "no channel" },
      diff_hints: false,
      provider_limit: "detects",
    },
    availability: { status: "available", version: null },
    ...overrides,
  };
}

export function skillContract(overrides: Partial<SkillContract> = {}): SkillContract {
  return {
    id: "skill-1",
    source: skillSource(overrides.project_id ?? null),
    project_id: null,
    canonical_path: "/home/u/.claude/skills/review/SKILL.md",
    name: "Review",
    description: "Review a diff",
    content_hash: "abc",
    status: "available",
    invalid_reason: null,
    enabled: true,
    ...overrides,
  };
}

export function agentProfile(overrides: Partial<AgentProfileContract> = {}): AgentProfileContract {
  return {
    id: "p1",
    name: "Implementer",
    project_id: null,
    runtime: "fake",
    options: {},
    model: null,
    guidance: null,
    skill_ids: [],
    ...overrides,
  };
}
