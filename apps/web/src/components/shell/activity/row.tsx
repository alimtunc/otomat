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
  onNavigate: () => void;
}

export function ActivityRow({ activity, onNavigate }: ActivityRowProps) {
  const target = activityTarget(activity);
  const abort = useAbortRun(activity.run_id);
  const cancelable = activity.kind === "run" && canAbortRun(activity.status);
  const error = activity.kind === "pull_request_publication" ? activity.operation.error : null;

  return (
    <li className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-hover">
      {/* Containing block: the sr-only issue name otherwise inflates the panel's scroll height. */}
      <Link
        to={target.to}
        params={target.params}
        onClick={onNavigate}
        className="relative min-w-0 flex-1 focus-visible:outline-none"
      >
        <span className="sr-only">{activity.issue.identifier ?? activity.issue.title}</span>
        <span className="flex items-center gap-1.5">
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
          <span className="truncate text-xs text-text-secondary">
            {KIND_LABELS[activity.kind]}
            {activity.phase === null ? "" : ` · ${activity.phase}`}
          </span>
          {/* `text-micro` through `cn` reads as a text colour and would drop RelativeTime's own. */}
          <span className="shrink-0 text-micro">
            <RelativeTime date={activity.updated_at} />
          </span>
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
    </li>
  );
}
