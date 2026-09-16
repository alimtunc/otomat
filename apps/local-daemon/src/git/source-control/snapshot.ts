import { createHash } from "node:crypto";

import type { SourceControlResponse } from "@otomat/domain";

import { computeCanonicalDiff, toDiffFileContract, worktreeStateTree } from "../diff.js";
import { runGit } from "../git-cli.js";
import { currentBranch, headSha } from "../repo.js";

export interface CheckoutSnapshot {
  head: string;
  index: string;
  tree: string;
  response: SourceControlResponse;
}

export function sourceControlSnapshot(cwd: string): CheckoutSnapshot {
  const head = headSha(cwd);
  const branch = currentBranch(cwd);
  const unmerged = runGit(["ls-files", "--unmerged", "-z"], { cwd }).stdout;
  const conflicts = [
    ...new Set(
      unmerged
        .split("\0")
        .filter(Boolean)
        .map((line) => line.slice(line.indexOf("\t") + 1)),
    ),
  ];
  if (conflicts.length > 0)
    return {
      head,
      index: "",
      tree: "",
      response: { branch, revision: "", staged: [], unstaged: [], conflicts },
    };
  const index = runGit(["write-tree"], { cwd }).stdout.trim();
  const tree = worktreeStateTree(cwd, index);
  const revision = createHash("sha256").update(`${branch}:${head}:${index}:${tree}`).digest("hex");
  return {
    head,
    index,
    tree,
    response: {
      branch,
      revision,
      conflicts,
      staged: computeCanonicalDiff(cwd, head, index).files.map(toDiffFileContract),
      unstaged: computeCanonicalDiff(cwd, index, tree).files.map(toDiffFileContract),
    },
  };
}
