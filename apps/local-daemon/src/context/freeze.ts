import { getIssue, type Db } from "@otomat/db";
import {
  contextReferenceKey,
  type ContextFile,
  type ContextIssue,
  type ContextReference,
  type ContextReviewComment,
  type ContextSelection,
} from "@otomat/domain";

import type { TreeSnapshot } from "#git";

import { readContextFile } from "./files.js";
import { issueContext, type ContextIssueRow } from "./issues.js";

export interface ContextFreezerInput {
  db: Db;
  /** The run's own issue; null only for a run that has none. */
  issue: ContextIssueRow | null;
  /** Tree every attached file is read from; null when the repository is unavailable, which the files then say. */
  snapshot: TreeSnapshot | null;
  capturedAt: string;
}

export type ContextFreezer = (
  references: readonly ContextReference[],
  note: string | null,
  reviewComments?: readonly ContextReviewComment[],
) => ContextSelection;

interface ResolvedReferences {
  issues: ContextIssue[];
  files: ContextFile[];
}

function resolve(input: ContextFreezerInput, references: readonly ContextReference[]) {
  const own =
    input.issue === null ? [] : [contextReferenceKey({ kind: "issue", issue_id: input.issue.id })];
  const seen = new Set(own);
  const resolved: ResolvedReferences = { issues: [], files: [] };
  for (const reference of references) {
    const key = contextReferenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    if (reference.kind === "issue") {
      const row = getIssue(input.db, reference.issue_id);
      if (row) resolved.issues.push(issueContext(row));
      continue;
    }
    resolved.files.push(
      input.snapshot === null
        ? { state: "unavailable", path: reference.path, reason: "unreadable" }
        : readContextFile(input.snapshot, reference.path),
    );
  }
  return resolved;
}

/** One freezer per launch or revision: every node reads the same captured tree, so a plan cannot mix two instants of the repository. */
export function createContextFreezer(input: ContextFreezerInput): ContextFreezer {
  const byReferences = new Map<string, ResolvedReferences>();
  const issue = input.issue === null ? null : issueContext(input.issue);
  return (references, note, reviewComments) => {
    const key = references.map(contextReferenceKey).join("|");
    const cached = byReferences.get(key) ?? resolve(input, references);
    byReferences.set(key, cached);
    return {
      captured_at: input.capturedAt,
      issue,
      issues: cached.issues,
      files: cached.files,
      review_comments: [...(reviewComments ?? [])],
      note,
    };
  };
}
