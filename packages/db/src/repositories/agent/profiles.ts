import {
  agentProfileContractSchema,
  providerOptionsSchema,
  type ProviderOptions,
} from "@otomat/domain";
import { eq } from "drizzle-orm";

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

/** Throws (Zod) when the row's `options_json` or `skill_ids_json` is corrupt; `undefined` means no row matched `id`. */
export function getAgentProfile(db: Db, id: string): AgentProfileRow | undefined {
  const row = db.select().from(agentProfiles).where(eq(agentProfiles.id, id)).get();
  return row ? hydrate(row) : undefined;
}

export function listAgentProfiles(db: Db): AgentProfileRow[] {
  return db.select().from(agentProfiles).orderBy(agentProfiles.created_at).all().map(hydrate);
}

export function updateAgentProfile(db: Db, id: string, columns: Omit<NewAgentProfile, "id">): void {
  db.update(agentProfiles).set(touch(columns)).where(eq(agentProfiles.id, id)).run();
}

export function deleteAgentProfile(db: Db, id: string): void {
  db.delete(agentProfiles).where(eq(agentProfiles.id, id)).run();
}
