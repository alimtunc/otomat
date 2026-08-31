import type { AgentProfileReplicaEntry } from "@otomat/domain";

/** Options arrive as parsed JSON, so their key order is not stable enough to compare on. */
function definition(entry: AgentProfileReplicaEntry): string {
  const options = Object.entries(entry.options).toSorted(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify([entry.runtime, entry.model, options, entry.guidance, entry.skill_ids]);
}

function ordering(entry: AgentProfileReplicaEntry): string {
  return JSON.stringify([entry.name, definition(entry), entry.created_at]);
}

/** SQLite stamps whole seconds, so the tie-breakers decide as often as `updated_at` does. */
function winner(
  a: AgentProfileReplicaEntry,
  b: AgentProfileReplicaEntry,
): AgentProfileReplicaEntry {
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at ? a : b;
  if ((a.deleted_at === null) !== (b.deleted_at === null)) return a.deleted_at === null ? b : a;
  return ordering(a) >= ordering(b) ? a : b;
}

function earlier(a: AgentProfileReplicaEntry, b: AgentProfileReplicaEntry): boolean {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at;
  return a.id < b.id;
}

/** Names were never unique here, so only a shared name *and* definition is a duplicate. */
function collapseDuplicates(entries: AgentProfileReplicaEntry[]): AgentProfileReplicaEntry[] {
  const keyed = entries.map((entry) => [entry, `${entry.name} ${definition(entry)}`] as const);
  const survivors = new Map<string, AgentProfileReplicaEntry>();
  for (const [entry, key] of keyed) {
    if (entry.deleted_at !== null) continue;
    const held = survivors.get(key);
    if (held === undefined || earlier(entry, held)) survivors.set(key, entry);
  }
  return keyed.map(([entry, key]) => {
    if (entry.deleted_at !== null) return entry;
    const survivor = survivors.get(key);
    if (survivor === undefined || survivor.id === entry.id) return entry;
    return { ...entry, deleted_at: entry.updated_at };
  });
}

export function mergeAgentProfileReplicas(
  mine: readonly AgentProfileReplicaEntry[],
  theirs: readonly AgentProfileReplicaEntry[],
): AgentProfileReplicaEntry[] {
  const byId = new Map<string, AgentProfileReplicaEntry>();
  for (const entry of [...mine, ...theirs]) {
    const held = byId.get(entry.id);
    byId.set(entry.id, held === undefined ? entry : winner(held, entry));
  }
  return collapseDuplicates([...byId.values()]).toSorted((a, b) => (earlier(a, b) ? -1 : 1));
}
