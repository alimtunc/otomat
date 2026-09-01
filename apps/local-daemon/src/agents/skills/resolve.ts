import { getSkill, type Db, type SkillRow } from "@otomat/db";
import { isSkillInScope, skillSource, type ResolvedSkill } from "@otomat/domain";

import { SkillResolutionError } from "../errors.js";
import { readSkillContent } from "./content.js";

const SKILL_INSTRUCTIONS_MAX_LENGTH = 64_000;

export function requireSkillInScope(db: Db, id: string, projectId: string | null): SkillRow {
  const skill = getSkill(db, id);
  if (!skill) {
    throw new SkillResolutionError("skill_unknown", `skill ${id} is not in the catalog`);
  }
  if (isSkillInScope(skill.project_id, projectId)) return skill;
  throw new SkillResolutionError(
    "skill_out_of_scope",
    projectId === null
      ? `skill "${skill.name}" belongs to a project, so a global agent cannot activate it`
      : `skill "${skill.name}" belongs to another project`,
  );
}

export function resolveSkills(
  db: Db,
  skillIds: readonly string[],
  projectId: string | null,
): ResolvedSkill[] {
  return skillIds.map((id) => {
    const skill = requireSkillInScope(db, id, projectId);
    if (!skill.enabled) {
      throw new SkillResolutionError("skill_unavailable", `skill "${skill.name}" is disabled`);
    }
    if (skill.status !== "available") {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" is ${skill.invalid_reason ?? "invalid"}`,
      );
    }
    const content = readSkillContent(skill.canonical_path);
    if (content === null) {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" file is unreadable`,
      );
    }
    if (content.content.length > SKILL_INSTRUCTIONS_MAX_LENGTH) {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" exceeds the ${SKILL_INSTRUCTIONS_MAX_LENGTH}-character limit`,
      );
    }
    return {
      id: skill.id,
      name: skill.name,
      source: skillSource(skill.project_id),
      canonical_path: skill.canonical_path,
      content_hash: content.hash,
      instructions: content.content,
    };
  });
}
