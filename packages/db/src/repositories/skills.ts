import type { SkillInvalidReason, SkillSource, SkillStatus } from "@otomat/domain";
import { and, eq, ne, notInArray } from "drizzle-orm";

import type { Db } from "../client.js";
import { skills } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewSkill = typeof skills.$inferInsert;
export type SkillRow = typeof skills.$inferSelect;

/** Discovered facts about one skill file, written by a rescan. Excludes id and the user's `enabled` choice, both preserved across rescans. */
export interface SkillDiscovery {
  source: SkillSource;
  canonical_path: string;
  name: string;
  description: string | null;
  content_hash: string | null;
  status: SkillStatus;
  invalid_reason: SkillInvalidReason | null;
}

export function getSkill(db: Db, id: string): SkillRow | undefined {
  return db.select().from(skills).where(eq(skills.id, id)).get();
}

export function getSkillByPath(db: Db, canonicalPath: string): SkillRow | undefined {
  return db.select().from(skills).where(eq(skills.canonical_path, canonicalPath)).get();
}

export function listSkills(db: Db): SkillRow[] {
  return db.select().from(skills).orderBy(skills.name).all();
}

/**
 * Insert a freshly discovered skill or refresh an existing one by canonical
 * path, preserving its id and the user's `enabled` choice. Returns the row id
 * so a rescan can record which entries it saw.
 */
export function upsertSkillByPath(db: Db, newId: string, discovery: SkillDiscovery): string {
  const existing = getSkillByPath(db, discovery.canonical_path);
  if (existing) {
    db.update(skills)
      .set(
        touch({
          source: discovery.source,
          name: discovery.name,
          description: discovery.description,
          content_hash: discovery.content_hash,
          status: discovery.status,
          invalid_reason: discovery.invalid_reason,
        }),
      )
      .where(eq(skills.id, existing.id))
      .run();
    return existing.id;
  }
  db.insert(skills)
    .values({ id: newId, ...discovery })
    .run();
  return newId;
}

export function setSkillEnabled(db: Db, id: string, enabled: boolean): void {
  db.update(skills).set(touch({ enabled })).where(eq(skills.id, id)).run();
}

/**
 * After a rescan, flag any catalog entry not seen on disk as invalid
 * (`path_missing`) without deleting it, so a profile that still references it
 * resolves to an honest error instead of silently dropping the skill.
 */
export function markSkillsMissing(db: Db, seenIds: string[]): void {
  const missing = touch({
    status: "invalid" as const,
    invalid_reason: "path_missing" as const,
    content_hash: null,
  });
  if (seenIds.length === 0) {
    db.update(skills).set(missing).where(ne(skills.status, "invalid")).run();
    return;
  }
  db.update(skills)
    .set(missing)
    .where(and(notInArray(skills.id, seenIds), ne(skills.status, "invalid")))
    .run();
}
