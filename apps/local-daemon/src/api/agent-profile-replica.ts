import {
  listAgentProfileReplica,
  upsertAgentProfileReplica,
  type AgentProfileRow,
  type Db,
} from "@otomat/db";
import type { AgentProfileReplicaEntry } from "@otomat/domain";

import { mergeAgentProfileReplicas } from "#agents";

function toEntry(row: AgentProfileRow): AgentProfileReplicaEntry {
  return {
    id: row.id,
    name: row.name,
    runtime: row.runtime,
    options: row.options_json,
    model: row.model,
    guidance: row.guidance,
    skill_ids: row.skill_ids_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function mergeAgentProfileReplica(
  db: Db,
  incoming: readonly AgentProfileReplicaEntry[],
): AgentProfileReplicaEntry[] {
  const merged = mergeAgentProfileReplicas(listAgentProfileReplica(db).map(toEntry), incoming);
  db.transaction(
    () => {
      for (const entry of merged) {
        upsertAgentProfileReplica(db, {
          id: entry.id,
          name: entry.name,
          runtime: entry.runtime,
          options_json: entry.options,
          model: entry.model,
          guidance: entry.guidance,
          skill_ids_json: entry.skill_ids,
          created_at: entry.created_at,
          updated_at: entry.updated_at,
          deleted_at: entry.deleted_at,
        });
      }
    },
    { behavior: "immediate" },
  );
  return merged;
}
