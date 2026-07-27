import { isRunContributionRetriable, type RunContributionContract } from "@otomat/domain";
import { Button, RelativeTime, RunContributionStatusChip } from "@otomat/ui";
import { useRetryRunContribution } from "@web/api/runs/mutations";

const DELIVERED_FAILURE_HINT =
  "This message already reached the agent, so it is never sent twice — write a new one instead.";

/** Retry appears only for a failure that never reached the provider, so nothing here can replay an instruction. */
export function ConversationMessage({
  runId,
  contribution,
}: {
  runId: string;
  contribution: RunContributionContract;
}) {
  const retry = useRetryRunContribution(runId);
  const retriable = isRunContributionRetriable(contribution);

  return (
    <div role="listitem" className="flex flex-col gap-1.5 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-secondary">You</span>
        <RelativeTime date={contribution.created_at} className="text-xs" />
        <RunContributionStatusChip status={contribution.status} size="sm" />
      </div>
      <p className="whitespace-pre-wrap rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm text-text-primary">
        {contribution.body}
      </p>
      {contribution.error === null ? null : (
        <p className="text-xs text-danger">{contribution.error}</p>
      )}
      {contribution.status === "failed" && !retriable ? (
        <p className="text-xs text-text-tertiary">{DELIVERED_FAILURE_HINT}</p>
      ) : null}
      {retriable ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            loading={retry.isPending}
            onClick={() => retry.mutate(contribution.id)}
          >
            Retry delivery
          </Button>
        </div>
      ) : null}
    </div>
  );
}
