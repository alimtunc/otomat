import type { ReviewQueueEntry } from "@otomat/domain";
import { Chip, FOCUS_RING, Icon, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { PROVENANCE_LABEL, PROVENANCE_TONE } from "@web/lib/pull-request/provenance";

const ROW_CLASS = `flex items-start gap-2.25 rounded-md px-2.5 py-2.25 hover:bg-hover ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;

/** One waiting review, whichever surface owns it; the provenance chip is what says a diff is read-only. */
export function ReviewQueueRow({ entry }: { entry: ReviewQueueEntry }) {
  const body = (
    <>
      <Icon name="git-compare" aria-hidden className="mt-0.5 h-3.5 w-3.5 text-review" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{entry.label}</span>
        <span className="mt-0.5 block truncate font-mono text-xs text-text-tertiary">
          {entry.branch ?? "no branch reported"}
        </span>
      </span>
      {entry.kind === "run" ? <RunStatusChip status="review_ready" /> : null}
      {entry.provenance === null ? null : (
        <Chip tone={PROVENANCE_TONE[entry.provenance]}>{PROVENANCE_LABEL[entry.provenance]}</Chip>
      )}
    </>
  );

  return entry.kind === "run" ? (
    <Link to="/runs/$runId/diff" params={{ runId: entry.id }} className={ROW_CLASS}>
      {body}
    </Link>
  ) : (
    <Link
      to="/pull-requests/$pullRequestId/diff"
      params={{ pullRequestId: entry.id }}
      className={ROW_CLASS}
    >
      {body}
    </Link>
  );
}
