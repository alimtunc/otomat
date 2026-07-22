import { homedir } from "node:os";
import { join } from "node:path";

import { listProjects, type Db } from "@otomat/db";
import type { SkillSource } from "@otomat/domain";

export interface SkillRoot {
  dir: string;
  source: SkillSource;
}

export interface SkillRootsOptions {
  /** Home directory for the user skills root; defaults to the OS home. Null disables the user root. */
  home?: string | null;
}

const PROJECT_SKILL_DIRS = [".agents/skills", ".claude/skills"];

/**
 * The bounded, known roots the skills scanner may read: each registered
 * project's tree and the user's home skills. It never walks the whole home
 * directory — only these explicit directories, one level deep.
 */
export function skillDiscoveryRoots(db: Db, options: SkillRootsOptions = {}): SkillRoot[] {
  const roots: SkillRoot[] = [];
  for (const project of listProjects(db)) {
    for (const dir of PROJECT_SKILL_DIRS) {
      roots.push({ dir: join(project.root_path, dir), source: "project" });
    }
  }
  const home = options.home === undefined ? homedir() : options.home;
  if (home) roots.push({ dir: join(home, ".claude", "skills"), source: "user" });
  return roots;
}
