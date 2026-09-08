import type { InboxEntry } from "@otomat/domain";
import { Button } from "@otomat/ui";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";

export interface InboxBulkActionsProps {
  visible: readonly InboxEntry[];
  selected: readonly InboxEntry[];
  pending: boolean;
  onMark: (entries: readonly InboxEntry[], patch: InboxMarkPatch) => void;
  onClearSelection: () => void;
}

export function InboxBulkActions({
  visible,
  selected,
  pending,
  onMark,
  onClearSelection,
}: InboxBulkActionsProps) {
  if (selected.length === 0) {
    const unread = visible.filter((entry) => !entry.read);
    const read = visible.filter((entry) => entry.read && !entry.archived);
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || unread.length === 0}
          onClick={() => onMark(unread, { read: true })}
        >
          Mark all read
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || read.length === 0}
          onClick={() => onMark(read, { archived: true })}
        >
          Archive read
        </Button>
      </>
    );
  }

  const archived = selected.every((entry) => entry.archived);
  return (
    <>
      <span className="text-xs text-text-tertiary">{selected.length} selected</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => onMark(selected, { read: true })}
      >
        Read
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => onMark(selected, { read: false })}
      >
        Unread
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => onMark(selected, { archived: !archived })}
      >
        {archived ? "Restore" : "Archive"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={onClearSelection}>
        Clear selection
      </Button>
    </>
  );
}
