import type { LinearLifecycleReadiness } from "@otomat/domain";
import { TONE_TEXT, type StatusTone } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { lifecycleReadinessSentence } from "@web/lib/linear-lifecycle";

const TONE: Record<LinearLifecycleReadiness["status"], StatusTone> = {
  unavailable: "stale",
  unmapped: "warning",
  incomplete: "warning",
  failing: "danger",
  ready: "success",
};

export interface LifecycleReadinessProps {
  readiness: LinearLifecycleReadiness;
}

export function LifecycleReadiness({ readiness }: LifecycleReadinessProps) {
  return (
    <p className={`text-xs ${TONE_TEXT[TONE[readiness.status]]}`}>
      {lifecycleReadinessSentence(readiness)}
      {readiness.status === "failing" ? (
        <Link
          className="ml-1.5 underline"
          to="/issues/$issueId"
          params={{ issueId: readiness.error.issue_id }}
          hash={`linear-write-${readiness.error.write_id}`}
        >
          Retry it on the issue
        </Link>
      ) : null}
    </p>
  );
}
