import {
  canFollowUpRun,
  isRunResumable,
  isRunSettled,
  type RunContract,
  type RunContributionContract,
} from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useDeliverRunContributions } from "@web/api/runs/mutations";
import { queuedCount } from "@web/lib/run/contribution";

function queuedNote(status: RunContract["status"], label: string): string {
  if (isRunSettled(status)) {
    return isRunResumable(status)
      ? `${label} still queued — this run stopped, so delivery waits for an explicit resume.`
      : `${label} still queued and will never be delivered — this run is finished.`;
  }
  if (status === "queued" || status === "preparing") {
    return `${label} waiting for capacity and will be delivered in this run's first turn.`;
  }
  if (status === "waiting_for_provider") {
    return `${label} waiting — this run resumes when its provider quota reopens, and carries them then.`;
  }
  if (canFollowUpRun(status)) {
    return `${label} waiting — this run is paused, so delivery needs an explicit resume.`;
  }
  return `${label} queued and will be delivered at the next safe turn.`;
}

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
