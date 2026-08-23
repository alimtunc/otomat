import {
  isRunContributionCancelable,
  isRunContributionRetriable,
  projectRunContributionDelivery,
  type RunContributionContract,
} from "@otomat/domain";
import { Button, Markdown, RelativeTime, RunContributionStatusChip } from "@otomat/ui";
import { useCancelRunContribution, useRetryRunContribution } from "@web/api/runs/mutations";
import { participantLabel } from "@web/lib/execution/labels";

const DELIVERED_FAILURE_HINT =
  "This message already reached the agent, so it is never sent twice — write a new one instead.";

export function ConversationMessage({
  runId,
  contribution,
}: {
  runId: string;
  contribution: RunContributionContract;
}) {
  const retry = useRetryRunContribution(runId);
  const cancel = useCancelRunContribution(runId);
  const retriable = isRunContributionRetriable(contribution);
  const cancelable = isRunContributionCancelable(contribution);

  return (
    <li className="flex flex-col gap-1.5 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-secondary">You</span>
        <RelativeTime date={contribution.created_at} className="text-xs" />
        <RunContributionStatusChip
          status={projectRunContributionDelivery(contribution)}
          size="sm"
        />
      </div>
      <Markdown
        value={contribution.body}
        className="rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm"
      />
      {contribution.target_config ? (
        <p className="text-[10px] text-text-tertiary">
          To {participantLabel(contribution.target_config)}
        </p>
      ) : null}
      {contribution.error === null ? null : (
        <p className="text-xs text-danger">{contribution.error}</p>
      )}
      {contribution.status === "failed" && !retriable ? (
        <p className="text-xs text-text-tertiary">{DELIVERED_FAILURE_HINT}</p>
      ) : null}
      {retriable || cancelable ? (
        <div className="flex flex-wrap gap-2">
          {retriable ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              loading={retry.isPending}
              onClick={() => retry.mutate(contribution.id)}
            >
              Retry delivery
            </Button>
          ) : null}
          {cancelable ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(contribution.id)}
            >
              Cancel message
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
