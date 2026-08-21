import type { ActivityContract } from "@otomat/domain";
import { Button, RelativeTime, StatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useAbortRun } from "@web/api/runs/mutations";
import { activityTarget } from "@web/components/shell/activity/target";
import { canAbortRun } from "@web/lib/run/actions";

const KIND_LABELS = {
  run: "Run",
  pull_request_publication: "Pull request",
} satisfies Record<ActivityContract["kind"], string>;

export interface ActivityRowProps {
  activity: ActivityContract;
  /** Execution host this snapshot came from; every row names it, because a project alone does not say where it runs. */
  hostLabel: string;
  onNavigate: () => void;
}

export function ActivityRow({ activity, hostLabel, onNavigate }: ActivityRowProps) {
  const target = activityTarget(activity);
  const abort = useAbortRun(activity.run_id);
  const cancelable = activity.kind === "run" && canAbortRun(activity.status);
  const error = activity.kind === "pull_request_publication" ? activity.operation.error : null;

  return (
    <li className="rounded-md px-2 py-1.5 hover:bg-hover">
      <div className="flex items-start gap-2">
        <Link
          to={target.to}
          params={target.params}
          onClick={onNavigate}
          className="min-w-0 flex-1 focus-visible:outline-none"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {activity.issue.identifier ?? activity.issue.title}
            </span>
            {activity.kind === "run" ? (
              <StatusChip kind="run" status={activity.status} size="sm" showLabel={false} />
            ) : (
              <StatusChip
                kind="operation"
                status={activity.operation.state}
                size="sm"
                showLabel={false}
              />
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-text-secondary">
            {KIND_LABELS[activity.kind]}
            {activity.phase === null ? "" : ` · ${activity.phase}`}
          </span>
          <span className="mt-0.5 block truncate text-micro text-text-tertiary">
            {activity.project.name} · {hostLabel} · <RelativeTime date={activity.updated_at} />
          </span>
          {error === null ? null : (
            <span className="mt-0.5 block truncate text-micro text-danger">{error.message}</span>
          )}
        </Link>
        {cancelable ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            loading={abort.isPending}
            onClick={() => abort.mutate()}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </li>
  );
}
