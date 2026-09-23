import { worktreeStateTree } from "./diff.js";
import { currentBranch } from "./repo.js";
import type { WorktreeTree } from "./service-contract.js";
import { listTreeFiles, readTreeBlob, readTreeFile } from "./tree-file.js";

export async function checkoutTree(cwd: string): Promise<WorktreeTree & { branch: string }> {
  const branch = await currentBranch(cwd);
  const tree = await worktreeStateTree(cwd, "HEAD");
  return {
    branch,
    worktreePath: cwd,
    entries: () => listTreeFiles(cwd, tree),
    readFile: (path, limits) => readTreeFile(cwd, tree, path, limits),
    readBlob: (oid) => readTreeBlob(cwd, oid),
  };
}
