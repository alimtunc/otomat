import type { IssueContract } from "@otomat/domain";
import { ColorDot } from "@web/components/issues/color-dot";
import { linearPriorityLabel } from "@web/lib/linear-priority";

const CHIP =
  "inline-flex h-4.5 items-center gap-1 rounded-full border border-border-subtle px-1.75 text-micro text-text-secondary";

export function CardChips({ issue }: { issue: IssueContract }) {
  const priority = issue.source_priority;
  const showPriority = priority !== null && priority !== 0;
  const labels = issue.source_labels ?? [];
  if (!showPriority && labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {showPriority ? <span className={CHIP}>{linearPriorityLabel(priority)}</span> : null}
      {labels.map((label) => (
        <span key={label.name} className={CHIP}>
          <ColorDot color={label.color} />
          {label.name}
        </span>
      ))}
    </span>
  );
}
