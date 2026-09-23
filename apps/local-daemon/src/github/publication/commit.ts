import type { PullRequestRow } from "@otomat/db";

import { uncommittedPaths } from "#git";

import { commitMessage } from "../conventions/compose.js";
import type { PublicationContext } from "./types.js";

/** Null leaves the commits the workspace already carries untouched: Otomat rewrites no published history. */
export async function publicationCommitMessage(
  row: PullRequestRow,
  context: PublicationContext,
): Promise<string | null> {
  if ((await uncommittedPaths(context.workspace.worktree.path)).length === 0) return null;
  const { subjectLine, identifier } = context.request;
  return commitMessage(subjectLine, row.commit_body, identifier);
}
