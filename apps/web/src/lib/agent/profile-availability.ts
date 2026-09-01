import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { runtimeAvailabilityLabel } from "@web/lib/runtime-availability";
import { isAvailableRuntime, runtimeById } from "@web/lib/runtimes";
import {
  skillAvailability,
  skillAvailabilityLabel,
  type SkillAvailability,
} from "@web/lib/skill-availability";

export type AgentProfileAvailability =
  | { usable: true; runtime: RuntimeDescriptor }
  | { usable: false; runtime: RuntimeDescriptor | undefined }
  | { usable: false; skill: SkillAvailability };

function blockingSkill(
  profile: AgentProfileContract,
  catalog: SkillContract[],
): SkillAvailability | null {
  for (const skillId of profile.skill_ids) {
    const availability = skillAvailability(skillId, catalog, profile.project_id);
    if (availability.status !== "available") return availability;
  }
  return null;
}

/** Another host is never consulted: its catalog is its own. */
export function agentProfileAvailability(
  profile: AgentProfileContract,
  descriptors: RuntimeDescriptor[],
  skills: SkillContract[],
): AgentProfileAvailability {
  const runtime = runtimeById(descriptors, profile.runtime);
  if (runtime === undefined || !isAvailableRuntime(runtime)) return { usable: false, runtime };
  const skill = blockingSkill(profile, skills);
  return skill === null ? { usable: true, runtime } : { usable: false, skill };
}

export function agentProfileAvailabilityLabel(
  availability: AgentProfileAvailability,
  hostLabel: string,
): string {
  if (!("skill" in availability)) return runtimeAvailabilityLabel(availability.runtime, hostLabel);
  const { skill } = availability;
  const subject = skill.skill === null ? "A configured skill" : `Skill “${skill.skill.name}”`;
  return `${subject}: ${skillAvailabilityLabel(skill, hostLabel)}`;
}
