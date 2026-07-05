import type { ReviewCommentRow } from "@otomat/db";

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

/** The fix-context the agent receives: `{comment, original hunk, current file}` + the issue/run summary. */
export function buildFixPrompt(input: FixPromptInput): string {
  const header = [
    `Fix the following review comments on branch ${input.branch}.`,
    "",
    `Issue: ${input.issueTitle}`,
    ...(input.issueBody ? ["", input.issueBody] : []),
  ];
  const sections = input.comments.map(renderComment);
  return [...header, "", ...sections].join("\n");
}
