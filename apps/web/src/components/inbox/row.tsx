import { FOCUS_RING, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { InboxRoute } from "@web/lib/inbox/target";
import type { ReactNode } from "react";

const ROW_CLASS = `flex h-11 items-center gap-3 rounded-md px-2.5 hover:bg-hover ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;

export interface InboxRowProps {
  link: InboxRoute;
  leading: ReactNode;
  identifier: string | null;
  title: string;
  reason: string;
  chips?: ReactNode;
  time: string;
  action: string;
}

export function InboxRow({
  link,
  leading,
  identifier,
  title,
  reason,
  chips,
  time,
  action,
}: InboxRowProps) {
  return (
    <Link {...link} className={ROW_CLASS}>
      {leading}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {identifier === null ? null : (
          <span className="font-mono text-xs text-text-tertiary">{identifier} </span>
        )}
        <span className="font-medium">{title}</span>
        <span className="text-xs text-text-tertiary"> — {reason}</span>
      </span>
      {chips}
      <span className="shrink-0 text-xs text-text-tertiary">
        <RelativeTime date={time} />
      </span>
      <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-border bg-surface-2 px-2 text-xs font-medium text-text-secondary">
        {action}
      </span>
    </Link>
  );
}
