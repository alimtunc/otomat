import { getIssue, type PullRequestRow } from "@otomat/db";

import { uncommittedPaths } from "#git";

import { commitMessage, subjectFromTitle } from "../conventions/compose.js";
import { subjectViolation } from "../conventions/conventional-commit.js";
import { detectCommitConvention } from "../conventions/detect.js";
import { GitHubPublicationError } from "../errors.js";
import type { PublicationConfig, PublicationContext } from "./types.js";

/** Null leaves the agent's own commits untouched; a subject the repository refuses throws before any push. */
export function publicationCommitMessage(
  config: PublicationConfig,
  row: PullRequestRow,
  context: PublicationContext,
): string | null {
  const { worktree, baseRef } = context.workspace;
  if (uncommittedPaths(worktree.path).length === 0) return null;

  const identifier = getIssue(config.db, context.run.issue_id)?.source_identifier ?? null;
  const subject = row.commit_subject ?? subjectFromTitle(context.request.title, identifier);
  const violation = subjectViolation(
    detectCommitConvention(worktree.path, baseRef).convention,
    subject,
  );
  if (violation !== null) {
    throw new GitHubPublicationError(
      "commit_convention_violation",
      `${violation} Edit the title, or generate the metadata again.`,
    );
  }
  return commitMessage(subject, row.commit_body, identifier);
}
