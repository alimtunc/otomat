import type { RunContract } from "@otomat/domain";
import { Icon, LiveDot, RunStatusChip, cn } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { shortId } from "@web/lib/ids";
import { isActiveRun } from "@web/lib/run-activity";

function runBadge(run: RunContract, latest: boolean): string | null {
  if (isActiveRun(run)) return "active";
  return latest ? "latest" : null;
}

function RunStripRow({
  run,
  latest,
  followed,
  onFollow,
}: {
  run: RunContract;
  latest: boolean;
  followed: boolean;
  onFollow: () => void;
}) {
  const badge = runBadge(run, latest);
  const active = isActiveRun(run);
  return (
    <li className={cn("flex items-center gap-1 pr-2", followed ? "bg-selected" : "hover:bg-hover")}>
      <button
        type="button"
        onClick={onFollow}
        aria-pressed={followed}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
      >
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
        {badge ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            {active ? <LiveDot /> : null}
            {badge}
          </span>
        ) : null}
      </button>
      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        aria-label={`Open run cockpit for ${shortId(run.id)}`}
        title="Open run cockpit"
        className="rounded-md p-1.5 text-text-tertiary hover:bg-hover hover:text-text-secondary"
      >
        <Icon name="activity" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * The issue's runs, oldest first. One run is "followed": its ledger feeds the
 * activity feed and the rail. Following a run never navigates away.
 */
export function RunStrip({
  runs,
  followedRunId,
  onFollow,
}: {
  runs: RunContract[];
  followedRunId: string | null;
  onFollow: (runId: string) => void;
}) {
  const latestId = runs.at(-1)?.id;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-secondary">Runs</h2>
      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {runs.map((run) => (
          <RunStripRow
            key={run.id}
            run={run}
            latest={run.id === latestId}
            followed={run.id === followedRunId}
            onFollow={() => onFollow(run.id)}
          />
        ))}
      </ul>
    </div>
  );
}
