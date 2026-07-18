import type { EventEnvelope } from "@otomat/domain";
import { Link } from "@tanstack/react-router";
import { asNumber } from "@web/lib/coerce";

export function DiffUpdatedDetail({ event }: { event: EventEnvelope }) {
  const additions = asNumber(event.payload["additions"]);
  const deletions = asNumber(event.payload["deletions"]);
  const fileCount = asNumber(event.payload["file_count"]);
  return (
    <span className="mt-1 inline-flex items-center gap-2 font-mono text-xs">
      {additions !== null ? <span className="text-success">+{additions}</span> : null}
      {deletions !== null ? <span className="text-danger">−{deletions}</span> : null}
      {fileCount !== null ? (
        <span className="text-text-tertiary">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
      ) : null}
      <Link
        to="/runs/$runId/diff"
        params={{ runId: event.run_id }}
        className="font-sans text-iris-text hover:underline"
      >
        View diff →
      </Link>
    </span>
  );
}
