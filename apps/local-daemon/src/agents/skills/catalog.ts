import { randomUUID } from "node:crypto";

import {
  listSkills,
  markSkillsMissing,
  upsertSkillByPath,
  type Db,
  type SkillRow,
} from "@otomat/db";

import { discoverSkills } from "./discovery.js";
import { skillDiscoveryRoots, type SkillRootsOptions } from "./roots.js";

/**
 * Rescans the known roots and reconciles the catalog: freshly discovered skills
 * are upserted by canonical path (preserving each row's id and `enabled`
 * choice), and any catalog entry no longer on disk is flagged `path_missing`
 * rather than deleted. Returns the reconciled catalog.
 */
export function rescanSkills(db: Db, options: SkillRootsOptions = {}): SkillRow[] {
  const discovered = discoverSkills(skillDiscoveryRoots(db, options));
  const seenIds = discovered.map((skill) => upsertSkillByPath(db, randomUUID(), skill));
  markSkillsMissing(db, seenIds);
  return listSkills(db);
}
