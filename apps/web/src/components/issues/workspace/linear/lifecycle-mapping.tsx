import { LINEAR_LIFECYCLE_PHASES, type IssueSourceLifecycle } from "@otomat/domain";
import { Link } from "@tanstack/react-router";
import { LIFECYCLE_PHASE_LABEL } from "@web/lib/linear-lifecycle";

export interface LifecycleMappingProps {
  mapping: IssueSourceLifecycle;
}

export function LifecycleMapping({ mapping }: LifecycleMappingProps) {
  const missing = LINEAR_LIFECYCLE_PHASES.filter((phase) => mapping[phase] === null);

  if (missing.length === 0) {
    const targets = LINEAR_LIFECYCLE_PHASES.flatMap((phase) => {
      const state = mapping[phase];
      return state === null ? [] : [`${LIFECYCLE_PHASE_LABEL[phase]} → ${state.name}`];
    });
    return (
      <p className="text-xs text-text-tertiary">
        <span className="text-text-secondary">Status sync</span> is configured: {targets.join(", ")}
      </p>
    );
  }

  return (
    <p className="text-xs text-text-tertiary">
      <span className="text-text-secondary">Status sync</span>{" "}
      {missing.length === LINEAR_LIFECYCLE_PHASES.length
        ? "is not configured, so runs and merges leave this issue untouched."
        : `has no state for ${missing
            .map((phase) => LIFECYCLE_PHASE_LABEL[phase].toLowerCase())
            .join(" and ")}, so that step leaves this issue untouched.`}{" "}
      <Link className="underline" to="/settings/project">
        Map its Linear statuses
      </Link>
    </p>
  );
}
