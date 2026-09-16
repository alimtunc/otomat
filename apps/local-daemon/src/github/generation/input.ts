import { getIssue, type Db, type RunRow } from "@otomat/db";

import type { CanonicalDiff, RepositoryResolver } from "#git";

import { GitHubPublicationError } from "../errors.js";

export interface GenerationIssue {
  sourceIdentifier: string | null;
  title: string;
  body: string | null;
}

export interface GenerationInput {
  cwd: string;
  issue: GenerationIssue | null;
  diffStat: string[];
  patch: string;
}

export function generationInput(
  cwd: string,
  issue: GenerationIssue | null,
  diff: CanonicalDiff,
): GenerationInput {
  return {
    cwd,
    issue,
    diffStat: diff.files.map((file) => `${file.path} +${file.additions} -${file.deletions}`),
    patch: diff.files.map((file) => file.patch).join("\n"),
  };
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
  return generationInput(
    worktree.path,
    {
      sourceIdentifier: issue?.source_identifier ?? null,
      title: issue?.title ?? "Untitled issue",
      body: issue?.body ?? null,
    },
    diff,
  );
}
