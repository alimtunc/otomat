import { treeRangeSnapshot, worktreeStateTree } from "./diff.js";
import { runGit } from "./git-cli.js";
import { commitParent, commitSummary, hasTree, headSha, revParse } from "./repo.js";
import type { CommitScope, DiffSnapshot } from "./service-contract.js";
import type { WorktreeStateCapture } from "./types.js";

// Written, not assumed: the well-known empty-tree sha is hash-algorithm specific,
// and a root commit still needs a real object on the base side of its diff.
async function emptyTree(repoRoot: string): Promise<string> {
  const written = await runGit(["hash-object", "-w", "-t", "tree", "/dev/null"], {
    cwd: repoRoot,
  });
  return written.stdout.trim();
}

export async function captureWorktreeState(worktreePath: string): Promise<WorktreeStateCapture> {
  // Resolved before the tree is written, so the pair can never name a head the tree was not built on.
  const head = await headSha(worktreePath);
  return { treeSha: await worktreeStateTree(worktreePath, head), headSha: head };
}

/** Null when git no longer holds one of the two captured trees — a loose boundary tree is prunable. */
export async function boundarySnapshot(
  repoRoot: string,
  startTree: string,
  endTree: string,
): Promise<DiffSnapshot | null> {
  if (!(await hasTree(repoRoot, startTree)) || !(await hasTree(repoRoot, endTree))) return null;
  return treeRangeSnapshot(repoRoot, startTree, endTree);
}

/** One commit against its own parent — never against the branch's fork point, which would read as the global diff. */
export async function commitScope(repoRoot: string, ref: string): Promise<CommitScope | null> {
  const summary = await commitSummary(repoRoot, ref);
  if (summary === null) return null;
  const parent = await commitParent(repoRoot, summary.sha);
  const base =
    parent === null ? await emptyTree(repoRoot) : await revParse(repoRoot, `${parent}^{tree}`);
  const tree = await revParse(repoRoot, `${summary.sha}^{tree}`);
  return { commit: summary, parent, snapshot: await treeRangeSnapshot(repoRoot, base, tree) };
}
