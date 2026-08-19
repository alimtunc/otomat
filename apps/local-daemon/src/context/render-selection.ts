import type {
  ContextFile,
  ContextIssue,
  ContextReviewComment,
  ContextSelection,
} from "@otomat/domain";

const FILE_REFUSAL_SENTENCE = {
  missing: "not present in this snapshot of the repository",
  binary: "binary, so it was not read",
  too_large: "past the size Otomat attaches, so it was not read",
  outside_repository: "not a repository-relative path, so it was refused",
  symlink: "a symlink, so it was refused rather than followed off the repository",
  unreadable: "unreadable in this snapshot",
} satisfies Record<Extract<ContextFile, { state: "unavailable" }>["reason"], string>;

function issueBlock(issue: ContextIssue, heading: string): string[] {
  const name = issue.identifier === null ? issue.title : `${issue.identifier} — ${issue.title}`;
  const meta = [
    `status: ${issue.source_state_name ?? issue.status}`,
    ...(issue.assignee === null ? [] : [`assignee: ${issue.assignee}`]),
    ...(issue.labels.length === 0 ? [] : [`labels: ${issue.labels.join(", ")}`]),
  ];
  return [
    `## ${heading}: ${name}`,
    meta.join(" · "),
    "",
    issue.body ?? "(no description)",
    ...(issue.body_truncated ? ["", "(description truncated)"] : []),
  ];
}

function fileBlock(file: ContextFile): string[] {
  if (file.state === "unavailable") {
    return [`## File: ${file.path}`, `Not attached: ${FILE_REFUSAL_SENTENCE[file.reason]}.`];
  }
  return [
    `## File: ${file.path}`,
    `${file.bytes} bytes, read from the repository snapshot.`,
    "",
    file.text,
  ];
}

function anchorLabel(comment: ContextReviewComment): string {
  if (comment.line === null) return " (whole file)";
  const lines =
    comment.start_line === null ? `${comment.line}` : `${comment.start_line}-${comment.line}`;
  return `:${lines} (${comment.side === "old" ? "base" : "head"} side)`;
}

/** The replacement stays a labelled block: the agent applies it, it never has to infer one from prose. */
function suggestionBlock(comment: ContextReviewComment): string[] {
  if (comment.suggestion === null) return [];
  return [
    "",
    "Suggested replacement for exactly the anchored lines.",
    "Original lines:",
    comment.suggestion_original ?? "",
    "Replace them with:",
    comment.suggestion,
  ];
}

function commentBlock(comment: ContextReviewComment, index: number): string[] {
  return [
    `### Comment ${index + 1} — ${comment.file_path}${anchorLabel(comment)}`,
    comment.body,
    ...suggestionBlock(comment),
    ...(comment.hunk === "" ? [] : ["", `Pinned hunk (diff ${comment.diff_sha}):`, comment.hunk]),
    ...(comment.current_file === null
      ? ["", "The file no longer exists in the worktree."]
      : ["", "Current file content:", comment.current_file]),
  ];
}

/** Rendered in the order the launcher showed it. */
export function renderSelection(selection: ContextSelection): string[] {
  const blocks: string[][] = [];
  if (selection.issue !== null) blocks.push(issueBlock(selection.issue, "Issue"));
  for (const issue of selection.issues) blocks.push(issueBlock(issue, "Referenced issue"));
  for (const file of selection.files) blocks.push(fileBlock(file));
  if (selection.review_comments.length > 0) {
    blocks.push([
      "## Review comments selected for this step",
      ...selection.review_comments.flatMap((comment, index) => [
        "",
        ...commentBlock(comment, index),
      ]),
    ]);
  }
  return blocks.flatMap((block) => ["", ...block]);
}
