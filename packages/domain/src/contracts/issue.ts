import { z } from "zod";

import { MANUAL_ISSUE_STATES } from "./entity-states.js";

/** Create a local issue without launching a run. */
export const createIssueRequestSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;

/** Why an issue could not be re-pointed at another project. */
export const ISSUE_PROJECT_MOVE_ERRORS = [
  "issue_not_found",
  "project_not_found",
  "issue_not_local",
] as const;

export const issueProjectMoveErrorSchema = z.object({
  error: z.enum(ISSUE_PROJECT_MOVE_ERRORS),
  message: z.string(),
});

/** Re-points a local issue at another project; a mirrored issue is refused because the next tracker sync would revert it. */
export const moveIssueProjectRequestSchema = z.object({ project_id: z.string().min(1) }).strict();
export type MoveIssueProjectRequest = z.infer<typeof moveIssueProjectRequestSchema>;

/** Why an issue's source status could not be set by hand. */
export const ISSUE_STATUS_ERRORS = [
  "issue_not_found",
  "issue_not_local",
  "issue_status_refused",
] as const;

export const issueStatusErrorSchema = z.object({
  error: z.enum(ISSUE_STATUS_ERRORS),
  message: z.string(),
});

/** Sets the source status of a local issue. */
export const setIssueStatusRequestSchema = z
  .object({ status: z.enum(MANUAL_ISSUE_STATES) })
  .strict();
export type SetIssueStatusRequest = z.infer<typeof setIssueStatusRequestSchema>;
