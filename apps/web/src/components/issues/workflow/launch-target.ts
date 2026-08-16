import type { IssueContract, StartRunRequest } from "@otomat/domain";

/** What the workflow runs on: an existing issue, or a new issue created from the goal. */
export type WorkflowLaunchTarget =
  | { kind: "issue"; issue: IssueContract }
  | { kind: "project"; projectId: string };

export function targetRequest(
  target: WorkflowLaunchTarget,
  goal: string,
): Pick<StartRunRequest, "issue_id" | "prompt" | "project_id"> {
  if (target.kind === "issue") return { issue_id: target.issue.id };
  return { prompt: goal.trim(), project_id: target.projectId };
}

/** The project a workflow composes in: its presets, and what every node's context picker searches. */
export function targetProjectId(target: WorkflowLaunchTarget): string {
  return target.kind === "issue" ? target.issue.project_id : target.projectId;
}
