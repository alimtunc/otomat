export interface ProjectSummary {
  id: string;
  name: string;
  repo?: string;
  branch?: string;
  health?: "healthy" | "degraded" | "unknown";
}
