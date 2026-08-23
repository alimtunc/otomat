import type { IssueContract, StartRunRequest } from "@otomat/domain";

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

export function targetProjectId(target: WorkflowLaunchTarget): string {
  return target.kind === "issue" ? target.issue.project_id : target.projectId;
}
