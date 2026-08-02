export interface ProjectSummary {
  id: string;
  name: string;
  repo?: string;
  branch?: string;
  /** Short badge distinguishing entries from different execution hosts. */
  tag?: string;
  health?: "healthy" | "degraded" | "unknown";
}
