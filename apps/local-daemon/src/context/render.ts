import type {
  ContextProgress,
  ContextPullRequest,
  ContextWorkspace,
  SessionContext,
} from "@otomat/domain";

import { renderSelection } from "./render-selection.js";

function workspaceBlock(workspace: ContextWorkspace): string[] {
  const location = workspace.path ?? "(the worktree is gone)";
  const lines = [
    "## Workspace",
    `host: ${workspace.host}`,
    `repository: ${workspace.repository}`,
    `worktree: ${location}`,
    `branch: ${workspace.branch}${workspace.base_branch === null ? "" : ` (forked from ${workspace.base_branch})`}`,
    `uncommitted files: ${workspace.uncommitted_files}`,
  ];
  const commits =
    workspace.commits.length === 0
      ? []
      : ["", "Commits on this branch:", ...workspace.commits.map((subject) => `- ${subject}`)];
  if (workspace.diff === null) {
    return [...lines, ...commits, "", "The worktree diff is unavailable."];
  }
  const { diff } = workspace;
  const files = diff.files.map(
    (file) => `- ${file.path} (${file.status}) +${file.additions} -${file.deletions}`,
  );
  return [
    ...lines,
    ...commits,
    "",
    `Diff ${diff.sha} against ${diff.base} (+${diff.additions} -${diff.deletions}):`,
    ...(files.length === 0 ? ["- (no file changed yet)"] : files),
    ...(diff.omitted_files === 0 ? [] : [`- (${diff.omitted_files} further file(s) not listed)`]),
  ];
}

function pullRequestBlock(pullRequest: ContextPullRequest): string[] {
  return [
    "## Pull request",
    `#${pullRequest.number} ${pullRequest.title} (${pullRequest.state})`,
    `head branch: ${pullRequest.head_branch} → base branch: ${pullRequest.base_branch}`,
    `published head: ${pullRequest.published_head_sha ?? "nothing published yet"}`,
    pullRequest.url,
  ];
}

function stepMarker(step: ContextProgress["steps"][number]): string {
  if (step.current) return " ← this session's step";
  return step.dependency ? " ← this step depends on it" : "";
}

function progressBlock(progress: ContextProgress): string[] {
  const reports = progress.steps.flatMap((step) =>
    step.report === null ? [] : ["", `### What "${step.name}" reported`, step.report],
  );
  return [
    "## Plan progress",
    ...progress.steps.map((step) => `- ${step.name}: ${step.status}${stepMarker(step)}`),
    ...reports,
  ];
}

/** The note stays last: it is the one instruction laid on top of the attached context. */
export function renderSessionContext(context: SessionContext): string {
  const lines = [
    "# Working context",
    `Captured by Otomat at ${context.captured_at} from its own records. It is not live:`,
    "re-read the worktree before changing anything, and do not call an issue tracker.",
    ...renderSelection(context.selection),
    ...(context.workspace === null ? [] : ["", ...workspaceBlock(context.workspace)]),
    ...(context.pull_request === null ? [] : ["", ...pullRequestBlock(context.pull_request)]),
    ...(context.progress === null ? [] : ["", ...progressBlock(context.progress)]),
  ];
  const note = context.selection.note;
  if (note === null || note.trim() === "") return lines.join("\n");
  return [...lines, "", "# Step instructions", note].join("\n");
}

export function renderPublicationDelta(
  pullRequest: ContextPullRequest,
  workspaceBranch: string,
): string {
  return [
    "# Publication update",
    "This cycle's pull request moved after your session's context was captured. It is read",
    "from Otomat's own records, so nothing here needs a GitHub lookup.",
    "",
    ...pullRequestBlock(pullRequest),
    "",
    `The workspace keeps its own branch ${workspaceBranch}; ${pullRequest.head_branch} is what this`,
    "pull request ships. Work through this pull request only: never open a second one,",
    "and never push another remote branch.",
  ].join("\n");
}
