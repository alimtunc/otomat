import type { LinearLifecyclePhase, LinearLifecycleReadiness } from "@otomat/domain";

export const LIFECYCLE_PHASE_LABEL = {
  in_progress: "Run started",
  done: "Pull request merged",
} satisfies Record<LinearLifecyclePhase, string>;

export function lifecycleReadinessSentence(readiness: LinearLifecycleReadiness): string {
  switch (readiness.status) {
    case "unavailable":
      return "Linear statuses are unavailable, so this source's run mapping cannot be changed right now.";
    case "unmapped":
      return "Not configured — runs and merges on this team's issues change nothing in Linear.";
    case "incomplete":
      return `Incomplete — ${readiness.missing
        .map((phase) => LIFECYCLE_PHASE_LABEL[phase].toLowerCase())
        .join(" and ")} writes nothing to Linear.`;
    case "failing":
      return `Last write failed: ${readiness.error.message}`;
    case "ready":
      return "Configured — runs and merged pull requests move this team's issues.";
  }
}
