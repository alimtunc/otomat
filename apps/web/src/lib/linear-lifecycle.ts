import type { LinearLifecyclePhase } from "@otomat/domain";

export const LIFECYCLE_PHASE_LABEL: Record<LinearLifecyclePhase, string> = {
  in_progress: "Run started",
  done: "Pull request merged",
};
