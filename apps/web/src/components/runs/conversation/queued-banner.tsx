import { canFollowUpRun, type RunContract, type RunContributionContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useDeliverRunContributions } from "@web/api/runs/mutations";
import { queuedCount } from "@web/lib/conversation";

/**
 * The honest status of messages still waiting. A resting run with a queue is the
 * post-restart case: the daemon never resumes a run on its own at boot, so
 * delivery needs an explicit action rather than a silent background spawn.
 */
export function QueuedBanner({
  run,
  contributions,
}: {
  run: RunContract;
  contributions: readonly RunContributionContract[];
}) {
  const deliver = useDeliverRunContributions(run.id);
  const queued = queuedCount(contributions);
  if (queued === 0) return null;

  const label = queued === 1 ? "1 message is" : `${queued} messages are`;
  const resting = canFollowUpRun(run.status);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-2 px-6 py-2">
      <p className="text-xs text-text-secondary">
        {resting
          ? `${label} waiting — this run is paused, so delivery needs an explicit resume.`
          : `${label} queued and will be delivered at this run's next safe turn.`}
      </p>
      {resting ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          loading={deliver.isPending}
          onClick={() => deliver.mutate(undefined)}
        >
          Deliver now
        </Button>
      ) : null}
    </div>
  );
}
