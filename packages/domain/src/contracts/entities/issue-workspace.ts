import { z } from "zod";

import { RUN_STATES } from "../entity-states.js";

const openWorkspaceSchema = z.object({
  state: z.literal("open"),
  /** Run that owns the canonical branch and worktree; every new action on the issue lands here. */
  run_id: z.string().min(1),
  branch: z.string().min(1),
  /** Status of the holding run, so a surface knows whether to offer Resume or Add step without loading the run. */
  run_status: z.enum(RUN_STATES),
  /** A turn is in flight: an appended step queues behind it instead of racing it in the same worktree. */
  busy: z.boolean(),
});
const closedWorkspaceSchema = z.object({
  state: z.literal("closed"),
  run_id: z.null(),
  branch: z.null(),
  run_status: z.null(),
  busy: z.literal(false),
});

/** The issue's canonical workspace. `open` names the run that holds it; only a merge or an explicit abandon closes it, and the next launch then starts a fresh cycle. */
export const issueWorkspaceSchema = z.discriminatedUnion("state", [
  openWorkspaceSchema,
  closedWorkspaceSchema,
]);
export type IssueWorkspace = z.infer<typeof issueWorkspaceSchema>;

export const CLOSED_ISSUE_WORKSPACE: IssueWorkspace = {
  state: "closed",
  run_id: null,
  branch: null,
  run_status: null,
  busy: false,
};
