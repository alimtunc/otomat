import { z } from "zod";

const openWorkspaceSchema = z.object({
  state: z.literal("open"),
  /** Run that owns the canonical branch and worktree; every new action on the issue lands here. */
  run_id: z.string().min(1),
  branch: z.string().min(1),
  /** A turn is in flight: an appended step queues behind it instead of racing it in the same worktree. */
  busy: z.boolean(),
});
const closedWorkspaceSchema = z.object({
  state: z.literal("closed"),
  run_id: z.null(),
  branch: z.null(),
  busy: z.literal(false),
});

/** The issue's canonical workspace. `open` names the run that holds it; a merge, an abort or a failure closes it and the next launch starts a fresh cycle. */
export const issueWorkspaceSchema = z.discriminatedUnion("state", [
  openWorkspaceSchema,
  closedWorkspaceSchema,
]);
export type IssueWorkspace = z.infer<typeof issueWorkspaceSchema>;

export const CLOSED_ISSUE_WORKSPACE: IssueWorkspace = {
  state: "closed",
  run_id: null,
  branch: null,
  busy: false,
};
