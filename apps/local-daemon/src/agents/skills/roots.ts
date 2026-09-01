import { homedir } from "node:os";
import { join } from "node:path";

import { listProjects, type Db } from "@otomat/db";

export interface SkillRoot {
  dir: string;
  project_id: string | null;
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
  // First root wins the canonical-path de-duplication: a symlinked user skill stays the user's.
  const home = options.home === undefined ? homedir() : options.home;
  if (home) roots.push({ dir: join(home, ".claude", "skills"), project_id: null });
  for (const project of listProjects(db)) {
    for (const dir of PROJECT_SKILL_DIRS) {
      roots.push({ dir: join(project.root_path, dir), project_id: project.id });
    }
  }
  return roots;
}
