import type { AgentProfileContract } from "@otomat/domain";

export type ProfileFilter = "all" | "skills" | "instructions";

export function isProfileFilter(value: string): value is ProfileFilter {
  return value === "all" || value === "skills" || value === "instructions";
}

export function matchesProfileFilter(
  profile: AgentProfileContract,
  filter: ProfileFilter,
): boolean {
  if (filter === "skills") return profile.skill_ids.length > 0;
  if (filter === "instructions") return Boolean(profile.guidance?.trim());
  return true;
}
