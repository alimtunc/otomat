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
