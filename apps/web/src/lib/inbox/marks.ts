import type { InboxEntry, InboxMark, MarkInboxRequest } from "@otomat/domain";

export type InboxMarkPatch = Partial<Pick<InboxMark, "read" | "archived">>;

export function markInboxRequest(
  entries: readonly InboxEntry[],
  patch: InboxMarkPatch,
): MarkInboxRequest {
  return {
    marks: entries.map((entry) => ({
      entry_id: entry.id,
      evidence_updated_at: entry.updated_at,
      read: patch.read ?? entry.read,
      archived: patch.archived ?? entry.archived,
    })),
  };
}
