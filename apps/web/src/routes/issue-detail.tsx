import { Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";

import { RouteShell } from "./shell";

export function IssueDetailRoute() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  return (
    <RouteShell
      active="issues"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: `#${issueId}`, current: true },
      ]}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton height={22} width="46%" />
          <Skeleton height={14} width="28%" />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4">
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="82%" />
          <Skeleton height={14} width="64%" />
        </div>
        <p className="text-sm text-text-tertiary">
          Loading issue — connect a daemon to populate this workspace (OTO-9).
        </p>
      </div>
    </RouteShell>
  );
}
