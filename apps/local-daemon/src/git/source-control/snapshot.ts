import { createHash } from "node:crypto";

import type { DiffFileContract, SourceControlResponse } from "@otomat/domain";

import { computeCanonicalDiff, worktreeStateTree } from "../diff.js";
import { runGit } from "../git-cli.js";
import type { DiffFile } from "../types.js";

export interface CheckoutSnapshot {
  head: string;
  index: string;
  tree: string;
  response: SourceControlResponse;
}

function contract(file: DiffFile): DiffFileContract {
  const { oldPath, ...rest } = file;
  return { ...rest, old_path: oldPath };
}

export function sourceControlSnapshot(cwd: string): CheckoutSnapshot {
  const head = runGit(["rev-parse", "HEAD"], { cwd }).stdout.trim();
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd }).stdout.trim();
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
      staged: computeCanonicalDiff(cwd, head, index).files.map(contract),
      unstaged: computeCanonicalDiff(cwd, index, tree).files.map(contract),
    },
  };
}
