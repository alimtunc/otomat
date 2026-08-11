import {
  canFollowUpRun,
  isRunTerminal,
  type RunContract,
  type RunContributionContract,
} from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useDeliverRunContributions } from "@web/api/runs/mutations";
import { queuedCount } from "@web/lib/run/contribution";

function queuedNote(status: RunContract["status"], label: string): string {
  if (isRunTerminal(status)) {
    return `${label} still queued and will never be delivered — this run is finished.`;
  }
  if (status === "queued" || status === "preparing") {
    return `${label} waiting for capacity and will be delivered in this run's first turn.`;
  }
  if (canFollowUpRun(status)) {
    return `${label} waiting — this run is paused, so delivery needs an explicit resume.`;
  }
  return `${label} queued and will be delivered at the next safe turn.`;
}

/** A resting run with a queue is the post-restart case: the daemon never resumes a run on its own at boot. */
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
      <p className="text-xs text-text-secondary">{queuedNote(run.status, label)}</p>
      {resting ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          loading={deliver.isPending}
          onClick={() => deliver.mutate()}
        >
          Deliver now
        </Button>
      ) : null}
    </div>
  );
}
