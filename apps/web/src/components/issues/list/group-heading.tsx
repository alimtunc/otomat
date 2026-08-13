import { resolveStatus, TONE_TEXT } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import type { IssueGroup } from "@web/lib/issue/grouping";

export function IssueGroupHeading({ group }: { group: IssueGroup }) {
  if (group.status !== null) {
    const meta = resolveStatus("issue", group.status);
    const StatusIcon = meta.icon;
    return (
      <span className="flex min-w-0 items-center gap-1.75">
        <StatusIcon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT[meta.tone]}`} />
        <span className="truncate">{group.label}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.75">
      {group.color !== null ? <ColorDot color={group.color} /> : null}
      <span className="truncate">{group.label}</span>
    </span>
  );
}
