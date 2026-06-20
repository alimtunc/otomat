import type { RunContract } from "@otomat/domain";
import {
  Button,
  EmptyState,
  ErrorState,
  IssueStatusChip,
  RunStatusChip,
  Skeleton,
} from "@otomat/ui";
import { Link, useParams } from "@tanstack/react-router";
import { Inbox, Play } from "lucide-react";

import { useIssue, useRunsForIssue } from "../lib/queries";
import { useStartRunAndNavigate } from "../lib/use-start-run";
import { RouteShell } from "./shell";

export function IssueDetailRoute() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const { start, isPending } = useStartRunAndNavigate();

  async function launch() {
    await start({ issue_id: issueId });
  }

  const title = issue.data?.title ?? `Issue ${issueId}`;

  return (
    <RouteShell
      active="issues"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: title, current: true },
      ]}
      actions={
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending || issue.isError}
          onClick={launch}
        >
          <Play aria-hidden />
          Start run
        </Button>
      }
    >
      <div className="flex flex-col gap-6 p-6">
        <IssueHeader query={issue} />
        <RunsList query={runs} />
      </div>
    </RouteShell>
  );
}

function IssueHeader({ query }: { query: ReturnType<typeof useIssue> }) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton height={24} width="46%" />
        <Skeleton height={14} width="28%" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load this issue"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const issue = query.data;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IssueStatusChip status={issue.status} />
        <span className="font-mono text-xs text-text-tertiary">{issue.source}</span>
      </div>
      <h1 className="text-lg font-semibold text-foreground">{issue.title}</h1>
      {issue.body ? (
        <p className="whitespace-pre-wrap text-sm text-text-secondary">{issue.body}</p>
      ) : null}
    </div>
  );
}

function RunsList({ query }: { query: ReturnType<typeof useRunsForIssue> }) {
  if (query.isPending) return <Skeleton height={44} />;

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load runs"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={Inbox}
          variant="inline"
          title="No runs yet"
          description="Start a run to launch the agent on this issue."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-secondary">Runs</h2>
      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {query.data.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ul>
    </div>
  );
}

function RunRow({ run }: { run: RunContract }) {
  return (
    <li>
      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-hover"
      >
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
      </Link>
    </li>
  );
}
