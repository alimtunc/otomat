import type { StartRunRequest } from "@otomat/domain";

/** What the workflow runs on: an existing issue, or a new issue created from the goal. */
export type WorkflowLaunchTarget =
  | { kind: "issue"; issueId: string }
  | { kind: "project"; projectId: string };

export function targetRequest(
  target: WorkflowLaunchTarget,
  goal: string,
): Pick<StartRunRequest, "issue_id" | "prompt" | "project_id"> {
  if (target.kind === "issue") return { issue_id: target.issueId };
  return { prompt: goal.trim(), project_id: target.projectId };
}
