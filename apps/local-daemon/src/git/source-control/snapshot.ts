import { createHash } from "node:crypto";

import type { SourceControlResponse } from "@otomat/domain";

import { computeCanonicalDiff, toDiffFileContract, worktreeStateTree } from "../diff.js";
import { runGit } from "../git-cli.js";
import { currentBranch, headSha } from "../repo.js";

export type CheckoutSnapshot =
  | {
      conflicted: false;
      head: string;
      index: string;
      tree: string;
      response: SourceControlResponse;
    }
  | { conflicted: true; head: string; response: SourceControlResponse };

function revisionOf(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

export function sourceControlSnapshot(cwd: string): CheckoutSnapshot {
  const head = headSha(cwd);
  const branch = currentBranch(cwd);
  const unmerged = runGit(["ls-files", "--unmerged", "-z"], { cwd }).stdout;
  if (unmerged !== "") {
    const conflicts = [
      ...new Set(
        unmerged
          .split("\0")
          .filter(Boolean)
          .map((line) => line.slice(line.indexOf("\t") + 1)),
      ),
    ];
    // No tree can be written from an unmerged index; its stage listing is the identity a resolution changes.
    const revision = revisionOf(branch, head, unmerged);
    return {
      conflicted: true,
      head,
      response: { branch, revision, staged: [], unstaged: [], conflicts },
    };
  }
  const index = runGit(["write-tree"], { cwd }).stdout.trim();
  const tree = worktreeStateTree(cwd, index);
  return {
    conflicted: false,
    head,
    index,
    tree,
    response: {
      branch,
      revision: revisionOf(branch, head, index, tree),
      conflicts: [],
      staged: computeCanonicalDiff(cwd, head, index).files.map(toDiffFileContract),
      unstaged: computeCanonicalDiff(cwd, index, tree).files.map(toDiffFileContract),
    },
  };
}
