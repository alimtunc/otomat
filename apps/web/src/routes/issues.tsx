import type { IssueContract } from "@otomat/domain";
import { EmptyState, ErrorState, IssueStatusChip, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { StartRunDialog } from "../components/start-run-dialog";
import { useIssues } from "../lib/queries";
import { RouteShell } from "./shell";

export function IssuesRoute() {
  const issues = useIssues();
  return (
    <RouteShell
      active="issues"
      breadcrumbs={[{ label: "Issues", current: true }]}
      actions={<StartRunDialog />}
    >
      <IssuesBody query={issues} />
    </RouteShell>
  );
}

function IssuesBody({ query }: { query: ReturnType<typeof useIssues> }) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 p-6">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={44} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <ErrorState
          title="Couldn’t load issues"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (query.data.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={Inbox}
          title="No issues yet"
          description="Start a local run to create your first issue and stream its events live."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {query.data.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}

function IssueRow({ issue }: { issue: IssueContract }) {
  return (
    <li>
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="flex items-center gap-3 px-6 py-3 hover:bg-hover"
      >
        <IssueStatusChip status={issue.status} showLabel={false} />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>
        <span className="font-mono text-xs text-text-tertiary">{issue.source}</span>
      </Link>
    </li>
  );
}
