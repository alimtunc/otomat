import type { InboxEntry } from "@otomat/domain";
import { Checkbox, Chip, Icon, IconButton, LiveDot } from "@otomat/ui";
import { InboxRow } from "@web/components/inbox/row";
import { INBOX_KIND_COPY, inboxEntryTone } from "@web/lib/inbox/labels";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import { inboxRoute } from "@web/lib/inbox/target";

export interface InboxEntryRowProps {
  entry: InboxEntry;
  selected: boolean;
  pending: boolean;
  onSelectedChange: (selected: boolean) => void;
  onMark: (patch: InboxMarkPatch) => void;
}

export function InboxEntryRow({
  entry,
  selected,
  pending,
  onSelectedChange,
  onMark,
}: InboxEntryRowProps) {
  const copy = INBOX_KIND_COPY[entry.kind];

  return (
    <InboxRow
      link={inboxRoute(entry.target)}
      selection={
        <Checkbox
          className="ml-1.5"
          checked={selected}
          aria-label={`Select ${entry.subject.title}`}
          onCheckedChange={(next) => onSelectedChange(next)}
        />
      }
      leading={
        <>
          <LiveDot tone="iris" size={6} className={entry.read ? "invisible" : undefined} />
          {entry.read ? null : <span className="sr-only">Unread</span>}
          <Chip tone={inboxEntryTone(entry)}>{copy.label}</Chip>
        </>
      }
      identifier={entry.subject.identifier}
      title={entry.subject.title}
      reason={
        entry.detail === null ? entry.project.name : `${entry.project.name} · ${entry.detail}`
      }
      time={entry.updated_at}
      action={entry.state === "resolved" ? "Resolved" : copy.action}
      muted={entry.read}
      actions={
        <span className="mr-1 flex shrink-0 items-center">
          <IconButton
            size="sm"
            label={entry.read ? "Mark as unread" : "Mark as read"}
            icon={<Icon name={entry.read ? "mail" : "mail-open"} aria-hidden />}
            disabled={pending}
            onClick={() => onMark({ read: !entry.read })}
          />
          <IconButton
            size="sm"
            label={entry.archived ? "Restore" : "Archive"}
            icon={<Icon name={entry.archived ? "archive-restore" : "archive"} aria-hidden />}
            disabled={pending}
            onClick={() => onMark({ archived: !entry.archived })}
          />
        </span>
      }
    />
  );
}
