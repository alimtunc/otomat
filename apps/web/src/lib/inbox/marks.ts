import type { InboxEntry, InboxMark, MarkInboxRequest } from "@otomat/domain";

export type InboxMarkPatch = Partial<Pick<InboxMark, "read" | "archived">>;

/** Any projected entry the marks table keys on: an Inbox demand or a conversation. */
type MarkableEntry = Pick<InboxEntry, "id" | "updated_at" | "read" | "archived">;

export function markInboxRequest(
  entries: readonly MarkableEntry[],
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

export function applyInboxMarks<Entry extends MarkableEntry, Snapshot extends { entries: Entry[] }>(
  snapshot: Snapshot,
  request: MarkInboxRequest,
): Snapshot {
  const marks = new Map(request.marks.map((mark) => [mark.entry_id, mark]));
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => {
      const mark = marks.get(entry.id);
      return mark === undefined ? entry : { ...entry, read: mark.read, archived: mark.archived };
    }),
  };
}
