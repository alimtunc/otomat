import type { InboxEntry } from "@otomat/domain";
import { Chip, FOCUS_RING, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { INBOX_KIND_COPY, inboxEntryTone } from "@web/lib/inbox/labels";
import { inboxRoute } from "@web/lib/inbox/target";

const ROW_CLASS = `flex flex-col gap-1 rounded-md px-2.5 py-2 hover:bg-hover ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;

export function InboxEntryRow({ entry }: { entry: InboxEntry }) {
  const copy = INBOX_KIND_COPY[entry.kind];
  const route = inboxRoute(entry.target);

  return (
    <Link {...route} className={ROW_CLASS}>
      <span className="flex items-center gap-2">
        <Chip tone={inboxEntryTone(entry)}>{copy.label}</Chip>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {entry.subject.identifier === null ? null : (
            <span className="font-mono text-xs text-text-tertiary">
              {entry.subject.identifier}{" "}
            </span>
          )}
          <span className="font-medium">{entry.subject.title}</span>
        </span>
        <span className="shrink-0 text-xs text-text-tertiary">
          <RelativeTime date={entry.updated_at} />
        </span>
      </span>
      <span className="flex items-center gap-2 text-xs text-text-tertiary">
        <span className="truncate">{entry.project.name}</span>
        {entry.detail === null ? null : <span className="truncate">· {entry.detail}</span>}
        <span className="truncate text-text-secondary">
          {entry.state === "resolved" ? "Resolved" : copy.action}
        </span>
      </span>
    </Link>
  );
}
