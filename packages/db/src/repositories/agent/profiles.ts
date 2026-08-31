import {
  agentProfileContractSchema,
  providerOptionsSchema,
  type ProviderOptions,
} from "@otomat/domain";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "#db/client";

import { agentProfiles } from "../schema.js";
import { touch } from "../touch.js";

export type NewAgentProfile = Omit<
  typeof agentProfiles.$inferInsert,
  "options_json" | "skill_ids_json"
> & {
  options_json: ProviderOptions;
  skill_ids_json: string[];
};

export type AgentProfileRow = Omit<
  typeof agentProfiles.$inferSelect,
  "options_json" | "skill_ids_json"
> & {
  options_json: ProviderOptions;
  skill_ids_json: string[];
};

function hydrate(row: typeof agentProfiles.$inferSelect): AgentProfileRow {
  return {
    ...row,
    options_json: providerOptionsSchema.parse(row.options_json),
    skill_ids_json: agentProfileContractSchema.shape.skill_ids.parse(row.skill_ids_json),
  };
}

export function insertAgentProfile(db: Db, value: NewAgentProfile): void {
  db.insert(agentProfiles).values(value).run();
}

/** Throws (Zod) when the row's `options_json` or `skill_ids_json` is corrupt; `undefined` means no live row matched `id`. */
export function getAgentProfile(db: Db, id: string): AgentProfileRow | undefined {
  const row = db
    .select()
    .from(agentProfiles)
    .where(and(eq(agentProfiles.id, id), isNull(agentProfiles.deleted_at)))
    .get();
  return row ? hydrate(row) : undefined;
}

export function listAgentProfiles(db: Db): AgentProfileRow[] {
  return db
    .select()
    .from(agentProfiles)
    .where(isNull(agentProfiles.deleted_at))
    .orderBy(agentProfiles.created_at)
    .all()
    .map(hydrate);
}

/** Every row this host holds, tombstones included: what one host hands another to converge the catalog. */
export function listAgentProfileReplica(db: Db): AgentProfileRow[] {
  return db.select().from(agentProfiles).orderBy(agentProfiles.created_at).all().map(hydrate);
}

export function updateAgentProfile(db: Db, id: string, columns: Omit<NewAgentProfile, "id">): void {
  db.update(agentProfiles).set(touch(columns)).where(eq(agentProfiles.id, id)).run();
}

/** Tombstones the row; `deleted_at` is what travels to the other hosts, so the delete is never undone by a sync. */
export function deleteAgentProfile(db: Db, id: string): void {
  db.update(agentProfiles)
    .set(touch({ deleted_at: sql`(CURRENT_TIMESTAMP)` }))
    .where(eq(agentProfiles.id, id))
    .run();
}

/** Writes a merged replica entry verbatim: its timestamps are the merge's answer, never this host's clock. */
export function upsertAgentProfileReplica(db: Db, value: AgentProfileRow): void {
  db.insert(agentProfiles)
    .values(value)
    .onConflictDoUpdate({ target: agentProfiles.id, set: value })
    .run();
}
