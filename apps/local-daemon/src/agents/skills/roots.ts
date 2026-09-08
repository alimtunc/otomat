import { homedir } from "node:os";
import { join } from "node:path";

import { listProjects, type Db } from "@otomat/db";

export interface SkillRoot {
  dir: string;
  project_id: string | null;
}

export interface SkillRootsOptions {
  home?: string | null;
}

const USER_SKILL_DIRS = [".agents/skills", ".claude/skills", ".codex/skills"];
const PROJECT_SKILL_DIRS = [".agents/skills", ".claude/skills"];

export function skillDiscoveryRoots(db: Db, options: SkillRootsOptions = {}): SkillRoot[] {
  const roots: SkillRoot[] = [];
  const home = options.home === undefined ? homedir() : options.home;
  if (home) {
    for (const dir of USER_SKILL_DIRS) roots.push({ dir: join(home, dir), project_id: null });
  }
  for (const project of listProjects(db)) {
    for (const dir of PROJECT_SKILL_DIRS) {
      roots.push({ dir: join(project.root_path, dir), project_id: project.id });
    }
  }
  return roots;
}
