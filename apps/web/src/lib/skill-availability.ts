import type { SkillContract, SkillInvalidReason } from "@otomat/domain";

export const SKILL_INVALID_REASON_LABELS = {
  frontmatter_missing: "No frontmatter",
  name_missing: "No name in frontmatter",
  unreadable: "File unreadable",
  path_missing: "File no longer on disk",
} satisfies Record<SkillInvalidReason, string>;

export type SkillAvailability =
  | { status: "available" | "disabled" | "invalid"; skill: SkillContract }
  | { status: "missing"; skill: null };

/** The reasons the daemon refuses a configured skill at launch (`agents/skills/resolve.ts`), read before one is attempted. */
export function skillAvailability(skillId: string, catalog: SkillContract[]): SkillAvailability {
  const skill = catalog.find((candidate) => candidate.id === skillId);
  if (skill === undefined) return { status: "missing", skill: null };
  if (skill.status !== "available") return { status: "invalid", skill };
  if (!skill.enabled) return { status: "disabled", skill };
  return { status: "available", skill };
}

export function skillAvailabilityLabel(availability: SkillAvailability, hostLabel: string): string {
  if (availability.status === "missing") return `Not found on ${hostLabel}`;
  if (availability.status === "disabled") return "Disabled in the skill catalog";
  if (availability.status === "invalid") {
    const reason = availability.skill.invalid_reason;
    return `${reason === null ? "Invalid" : SKILL_INVALID_REASON_LABELS[reason]} on ${hostLabel}`;
  }
  return `Available on ${hostLabel}`;
}
