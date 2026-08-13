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

/** The issue every step attaches, and the project its context picker searches; a goal has neither until the run creates one. */
export function targetContextScope(target: WorkflowLaunchTarget): {
  issue: IssueContract | null;
  projectId: string;
} {
  if (target.kind === "issue") {
    return { issue: target.issue, projectId: target.issue.project_id };
  }
  return { issue: null, projectId: target.projectId };
}
