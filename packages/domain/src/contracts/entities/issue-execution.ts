import { z } from "zod";

/** What Otomat is locally doing for an issue — never the issue's business/source `status`, which a run, review, or PR must not mutate. */
export const ISSUE_EXECUTION_STATES = ["running", "reviewing", "pr_open", "none"] as const;
export type IssueExecutionState = (typeof ISSUE_EXECUTION_STATES)[number];

const activeExecutionSchema = z.object({
  state: z.enum(["running", "reviewing", "pr_open"]),
  run_id: z.string().min(1),
});
const noExecutionSchema = z.object({ state: z.literal("none"), run_id: z.null() });

/** A projected state always names its run; `none` always has no run. The illegal in-between cannot be represented. */
export const issueExecutionSchema = z.union([activeExecutionSchema, noExecutionSchema]);
export type IssueExecution = z.infer<typeof issueExecutionSchema>;
