import type { StartRunRequest } from "@otomat/domain";

/** What the workflow runs on: an existing issue, or a new issue created from the goal. */
export type WorkflowLaunchTarget =
  | { kind: "issue"; issueId: string }
  | { kind: "project"; projectId: string | undefined };

/** The one reason a target cannot be launched on yet, or null when it can — shown by the form and enforced on submit. */
export function workflowLaunchBlocker(target: WorkflowLaunchTarget): string | null {
  return target.kind === "project" && target.projectId === undefined
    ? "Select a project before launching a workflow."
    : null;
}

export function targetRequest(
  target: WorkflowLaunchTarget,
  goal: string,
): Pick<StartRunRequest, "issue_id" | "prompt" | "project_id"> | null {
  if (target.kind === "issue") return { issue_id: target.issueId };
  if (target.projectId === undefined) return null;
  return { prompt: goal.trim(), project_id: target.projectId };
}
