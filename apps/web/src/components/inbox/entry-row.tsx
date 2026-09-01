import type { InboxEntry } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { InboxRow } from "@web/components/inbox/row";
import { INBOX_KIND_COPY, inboxEntryTone } from "@web/lib/inbox/labels";
import { inboxRoute } from "@web/lib/inbox/target";

export function InboxEntryRow({ entry }: { entry: InboxEntry }) {
  const copy = INBOX_KIND_COPY[entry.kind];

  return (
    <InboxRow
      link={inboxRoute(entry.target)}
      leading={<Chip tone={inboxEntryTone(entry)}>{copy.label}</Chip>}
      identifier={entry.subject.identifier}
      title={entry.subject.title}
      reason={
        entry.detail === null ? entry.project.name : `${entry.project.name} · ${entry.detail}`
      }
      time={entry.updated_at}
      action={entry.state === "resolved" ? "Resolved" : copy.action}
    />
  );
}
