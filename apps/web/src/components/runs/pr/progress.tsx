import { Spinner } from "@otomat/ui";
import { publicationPhases, type PublicationProgressInput } from "@web/components/runs/pr/phases";

const STATE_MARKS = { pending: "○", active: null, done: "●" } as const;

export function PullRequestProgress(input: PublicationProgressInput) {
  const phases = publicationPhases(input);
  if (phases.length === 0) return null;
  return (
    <ol aria-label="Publication progress" className="flex flex-wrap items-center gap-3 text-xs">
      {phases.map((phase) => (
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
