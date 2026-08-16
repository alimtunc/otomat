import { getIssue, type Db, type RunRow } from "@otomat/db";
import type { CommitConvention } from "@otomat/domain";

import type { RepositoryResolver } from "#git";

import { detectCommitConvention } from "../conventions/detect.js";
import { GitHubPublicationError } from "../errors.js";

export interface GenerationIssue {
  /** Tracker identifier such as `OTO-81`; null on a local issue, and then no footer is composed. */
  identifier: string | null;
  title: string;
  body: string | null;
}

export interface GenerationInput {
  cwd: string;
  issue: GenerationIssue;
  convention: CommitConvention;
  /** Recent subjects of the repository, so the convention is shown rather than described. */
  conventionEvidence: string[];
  diffStat: string[];
  patch: string;
}

export function buildGenerationInput(
  config: { db: Db; repositories: RepositoryResolver },
  run: RunRow,
): GenerationInput {
  const binding = config.repositories.forRun(run.id);
  const worktree = binding?.service.get(run.id);
  if (!binding || !worktree) {
    throw new GitHubPublicationError(
      "worktree_missing",
      "The run has no repository worktree to describe.",
    );
  }
  const diff = binding.service.diff(run.id);
  if (diff.files.length === 0) {
    throw new GitHubPublicationError("diff_empty", "The run has no changes to describe.");
  }
  const issue = getIssue(config.db, run.issue_id);
  const evidence = detectCommitConvention(worktree.path, worktree.baseRef || binding.defaultBranch);
  return {
    cwd: worktree.path,
    issue: {
      identifier: issue?.source_identifier ?? null,
      title: issue?.title ?? "Untitled issue",
      body: issue?.body ?? null,
    },
    convention: evidence.convention,
    conventionEvidence: evidence.subjects,
    diffStat: diff.files.map((file) => `${file.path} +${file.additions} -${file.deletions}`),
    patch: diff.files.map((file) => file.patch).join("\n"),
  };
}
