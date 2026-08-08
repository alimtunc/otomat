import type { ReviewCommentRow } from "@otomat/db";

import type { CanonicalDiff } from "#git";

/** Keeps the fix prompt bounded when a commented file is huge. */
const MAX_CURRENT_FILE_CHARS = 16_000;

export interface FixCommentContext {
  comment: ReviewCommentRow;
  /** Current worktree content of the commented file; null when it no longer exists. */
  currentFile: string | null;
}

export interface FixPromptInput {
  issueTitle: string;
  issueBody: string | null;
  branch: string;
  /** The diff the reviewer commented on; null when the run's worktree is gone. */
  diff: CanonicalDiff | null;
  comments: FixCommentContext[];
}

function truncate(text: string): string {
  if (text.length <= MAX_CURRENT_FILE_CHARS) return text;
  return `${text.slice(0, MAX_CURRENT_FILE_CHARS)}\n… (truncated)`;
}

function renderComment(context: FixCommentContext, index: number): string {
  const { comment, currentFile } = context;
  const current = currentFile === null ? "(file no longer exists)" : truncate(currentFile);
  return [
    `--- Review comment ${index + 1} ---`,
    `File: ${comment.file_path}`,
    `Line: ${comment.line}`,
    `Comment: ${comment.body}`,
    "",
    `Original hunk (pinned at diff ${comment.diff_sha}):`,
    comment.hunk_snapshot,
    "",
    "Current file content:",
    current,
  ].join("\n");
}

/** The diff the fix is measured against, named by its sha so the evidence stays checkable later. */
function renderDiff(diff: CanonicalDiff): string[] {
  const files = diff.files.map((file) => `${file.path} +${file.additions} -${file.deletions}`);
  return [
    `Current diff ${diff.sha} against ${diff.base} (+${diff.additions} -${diff.deletions}):`,
    ...files,
  ];
}

/** The fix-context frozen into the appended step: `{comment, original hunk, current file}`, the current diff, and what to do with them. */
export function buildFixPrompt(input: FixPromptInput): string {
  const header = [
    `Fix the following review comments on branch ${input.branch}.`,
    "",
    `Issue: ${input.issueTitle}`,
    ...(input.issueBody ? ["", input.issueBody] : []),
    "",
    ...(input.diff ? renderDiff(input.diff) : ["The run's worktree diff is unavailable."]),
    "",
    "Address every comment below in this worktree. Change nothing else, and leave the",
    "work uncommitted unless the repository's conventions say otherwise.",
  ];
  const sections = input.comments.map(renderComment);
  return [...header, "", ...sections].join("\n");
}
