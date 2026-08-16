import { StatusGlyph } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import type { IssueGroup } from "@web/lib/issue/grouping";

function groupGlyph(group: IssueGroup) {
  if (group.status !== null) return <StatusGlyph kind="issue" status={group.status} />;
  return group.color === null ? null : <ColorDot color={group.color} />;
}

export function IssueGroupHeading({ group }: { group: IssueGroup }) {
  return (
    <span className="flex min-w-0 items-center gap-1.75">
      {groupGlyph(group)}
      <span className="truncate">{group.label}</span>
    </span>
  );
}
