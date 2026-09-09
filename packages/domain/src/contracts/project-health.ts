import { z } from "zod";

export const PROJECT_HEALTH_CHECK_IDS = [
  "daemon",
  "repository",
  "git_remote",
  "worktrees_root",
  "linear",
  "github",
  "runtimes",
  "agents",
] as const;
export const projectHealthCheckIdSchema = z.enum(PROJECT_HEALTH_CHECK_IDS);
export type ProjectHealthCheckId = (typeof PROJECT_HEALTH_CHECK_IDS)[number];

export const PROJECT_HEALTH_STATUSES = ["ready", "warning", "unknown", "error"] as const;
export const projectHealthStatusSchema = z.enum(PROJECT_HEALTH_STATUSES);
export type ProjectHealthStatus = (typeof PROJECT_HEALTH_STATUSES)[number];

export const projectHealthCheckSchema = z.object({
  id: projectHealthCheckIdSchema,
  label: z.string().min(1),
  status: projectHealthStatusSchema,
  /** What the host found, already redacted there: never a token, an argument or raw command output. */
  message: z.string().min(1),
  remediation: z.string().nullable(),
});
export type ProjectHealthCheck = z.infer<typeof projectHealthCheckSchema>;

/** What a single probe answers; its identity and label belong to the report that composes it. */
export type ProjectHealthOutcome = Omit<ProjectHealthCheck, "id" | "label">;

export const projectHealthReportSchema = z.object({
  project_id: z.string(),
  /** When the host ran these checks, so a kept result reads as stale rather than as current. */
  checked_at: z.iso.datetime(),
  status: projectHealthStatusSchema,
  checks: z.array(projectHealthCheckSchema),
});
export type ProjectHealthReport = z.infer<typeof projectHealthReportSchema>;

/** An undetermined check outranks a degraded one, so it is never summarized as merely degraded. */
const SEVERITY = {
  ready: 0,
  warning: 1,
  unknown: 2,
  error: 3,
} satisfies Record<ProjectHealthStatus, number>;

export function summarizeProjectHealth(checks: readonly ProjectHealthCheck[]): ProjectHealthStatus {
  return checks.reduce<ProjectHealthStatus>(
    (worst, check) => (SEVERITY[check.status] > SEVERITY[worst] ? check.status : worst),
    "ready",
  );
}
