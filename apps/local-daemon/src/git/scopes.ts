import { treeRangeSnapshot, worktreeStateTree } from "./diff.js";
import { runGit } from "./git-cli.js";
import { commitParent, commitSummary, hasTree, headSha, revParse } from "./repo.js";
import type { CommitScope, DiffSnapshot } from "./service-contract.js";
import type { WorktreeStateCapture } from "./types.js";

// Written, not assumed: the well-known empty-tree sha is hash-algorithm specific,
// and a root commit still needs a real object on the base side of its diff.
function emptyTree(repoRoot: string): string {
  return runGit(["hash-object", "-w", "-t", "tree", "/dev/null"], { cwd: repoRoot }).stdout.trim();
}

export function captureWorktreeState(worktreePath: string): WorktreeStateCapture {
  // Resolved before the tree is written, so the pair can never name a head the tree was not built on.
  const head = headSha(worktreePath);
  return { treeSha: worktreeStateTree(worktreePath, head), headSha: head };
}

/** Null when git no longer holds one of the two captured trees — a loose boundary tree is prunable. */
export function boundarySnapshot(
  repoRoot: string,
  startTree: string,
  endTree: string,
): DiffSnapshot | null {
  if (!hasTree(repoRoot, startTree) || !hasTree(repoRoot, endTree)) return null;
  return treeRangeSnapshot(repoRoot, startTree, endTree);
}

/** One commit against its own parent — never against the branch's fork point, which would read as the global diff. */
export function commitScope(repoRoot: string, ref: string): CommitScope | null {
  const summary = commitSummary(repoRoot, ref);
  if (summary === null) return null;
  const parent = commitParent(repoRoot, summary.sha);
  const base = parent === null ? emptyTree(repoRoot) : revParse(repoRoot, `${parent}^{tree}`);
  const tree = revParse(repoRoot, `${summary.sha}^{tree}`);
  return { commit: summary, parent, snapshot: treeRangeSnapshot(repoRoot, base, tree) };
}
