import type { SkillContract } from "@otomat/domain";

export function skillSourceRoot(skill: Pick<SkillContract, "canonical_path" | "source">): string {
  const match = skill.canonical_path.match(/^(.*?\/|)(\.(?:agents|claude|codex)\/skills)(?:\/|$)/);
  if (match !== null) {
    const [, prefix, root] = match;
    if (skill.source === "project") return root;
    return /^(?:\/Users|\/home)\/[^/]+\/$/.test(prefix) ? `~/${root}` : `${prefix}${root}`;
  }
  return skill.canonical_path.replace(/\/[^/]+\/SKILL\.md$/, "");
}

export function filterSkills<
  T extends Pick<SkillContract, "name" | "description" | "canonical_path">,
>(skills: T[], search: string): T[] {
  const needle = search.trim().toLowerCase();
  return skills.filter((skill) =>
    [skill.name, skill.description ?? "", skill.canonical_path].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}
