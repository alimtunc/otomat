export type ConnectionState = "online" | "reconnecting" | "offline";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  repo?: string;
  branch?: string;
  health?: "healthy" | "degraded" | "unknown";
}
