import type { ProjectHealthStatus } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export interface ProjectHealthToneEntry {
  tone: StatusTone;
  label: string;
}

export const PROJECT_HEALTH_TONES = {
  ready: { tone: "success", label: "Ready" },
  warning: { tone: "warning", label: "Warning" },
  unknown: { tone: "stale", label: "Unknown" },
  error: { tone: "danger", label: "Error" },
} satisfies Record<ProjectHealthStatus, ProjectHealthToneEntry>;
