import type { LinearIssueNeighbor } from "@otomat/domain";
import { Icon } from "@otomat/ui";

import { IssueNeighbor } from "./neighbor";

export function IssueChildren({ issues }: { issues: LinearIssueNeighbor[] }) {
  if (issues.length === 0) return null;
  return (
    <section aria-label="Sub-issues" className="@container space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon name="list-tree" size="sm" className="text-text-tertiary" />
        Sub-issues{" "}
        <span className="rounded bg-surface-2 px-1.5 text-xs tabular-nums text-text-secondary">
          {issues.length}
        </span>
      </h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface-1 px-1">
        {issues.map((child) => (
          <IssueNeighbor key={child.external_id} issue={child} />
        ))}
      </div>
    </section>
  );
}
