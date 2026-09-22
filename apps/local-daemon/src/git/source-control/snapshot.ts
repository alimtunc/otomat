import { createHash } from "node:crypto";

import type { SourceControlResponse } from "@otomat/domain";

import { computeCanonicalDiff, toDiffFileContract, worktreeStateTree } from "../diff.js";
import { runGit } from "../git-cli.js";
import { inCheckout } from "../lock.js";
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

/** Unlocked: a caller holding the checkout's lock guards its write with the revision computed here. */
export async function readCheckoutSnapshot(cwd: string): Promise<CheckoutSnapshot> {
  const head = await headSha(cwd);
  const branch = await currentBranch(cwd);
  const unmerged = (await runGit(["ls-files", "--unmerged", "-z"], { cwd })).stdout;
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
  const index = (await runGit(["write-tree"], { cwd })).stdout.trim();
  const tree = await worktreeStateTree(cwd, index);
  const [staged, unstaged] = await Promise.all([
    computeCanonicalDiff(cwd, head, index),
    computeCanonicalDiff(cwd, index, tree),
  ]);
  return {
    conflicted: false,
    head,
    index,
    tree,
    response: {
      branch,
      revision: revisionOf(branch, head, index, tree),
      conflicts: [],
      staged: staged.files.map(toDiffFileContract),
      unstaged: unstaged.files.map(toDiffFileContract),
    },
  };
}

export function sourceControlSnapshot(cwd: string): Promise<CheckoutSnapshot> {
  return inCheckout(cwd, () => readCheckoutSnapshot(cwd));
}
