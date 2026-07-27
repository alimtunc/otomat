import type { RunContract } from "@otomat/domain";
import { Button, Icon, LiveDot, RelativeTime, RunStatusChip, cn } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { ConversationSection } from "@web/components/issues/workspace/conversation-section";
import { shortId } from "@web/lib/ids";
import { isActiveRun } from "@web/lib/run-activity";

function SectionHeader({
  run,
  expanded,
  onSelect,
}: {
  run: RunContract;
  expanded: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn("flex items-center gap-1 pr-2", expanded ? "bg-selected" : "hover:bg-hover")}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSelect}
        aria-pressed={expanded}
        className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-4 py-2.5 text-left font-normal"
      >
        <Icon name={expanded ? "chevron-down" : "chevron-right"} aria-hidden />
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
        {isActiveRun(run) ? <LiveDot /> : null}
        <RelativeTime date={run.updated_at} className="text-xs" />
      </Button>
      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        aria-label={`Open run cockpit for ${shortId(run.id)}`}
        title="Open run cockpit"
        className="rounded-md p-1.5 text-text-tertiary hover:bg-hover hover:text-text-secondary"
      >
        <Icon name="activity" aria-hidden />
      </Link>
    </div>
  );
}

/** Only the followed run holds an SSE connection, so the others stay collapsed on their last known status. */
export function RunConversations({
  runs,
  followedRunId,
  onFollow,
}: {
  runs: RunContract[];
  followedRunId: string | null;
  onFollow: (runId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-secondary">Conversations</h2>
      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {runs.map((run) => {
          const expanded = run.id === followedRunId;
          return (
            <li key={run.id} className="flex flex-col">
              <SectionHeader run={run} expanded={expanded} onSelect={() => onFollow(run.id)} />
              {expanded ? <ConversationSection runId={run.id} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
