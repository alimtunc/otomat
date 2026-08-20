import type { OperationContract } from "@otomat/domain";
import { Spinner } from "@otomat/ui";

const STATE_MARKS = { pending: "○", active: null, done: "●", failed: "✕" } as const;

export interface PullRequestProgressProps {
  operation: OperationContract | null;
}

export function PullRequestProgress({ operation }: PullRequestProgressProps) {
  if (operation === null) return null;
  return (
    <ol aria-label="Publication progress" className="flex flex-wrap items-center gap-3 text-xs">
      {operation.phases.map((phase) => (
        <li
          key={phase.key}
          aria-current={phase.state === "active" ? "step" : undefined}
          className={phase.state === "pending" ? "text-text-tertiary" : "text-text-secondary"}
        >
          <span className="inline-flex items-center gap-1.5">
            {phase.state === "active" ? (
              <Spinner size={10} label={phase.label} />
            ) : (
              STATE_MARKS[phase.state]
            )}
            {phase.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
