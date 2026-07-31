import { z } from "zod";

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
