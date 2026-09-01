import { runGit } from "./git-cli.js";
import { hasCommit, mergeBase, revParse } from "./repo.js";

export interface PullRequestFetchInput {
  repoRoot: string;
  remote: string;
  number: number;
  baseRef: string;
}

/** The two ends of an imported pull request's canonical diff, as this repository now holds them. */
export interface PullRequestTrees {
  base: string;
  head: string;
}

/** Re-fetching is how a moved head is picked up, so the head ref is forced. */
export function fetchPullRequestTrees(input: PullRequestFetchInput): PullRequestTrees {
  // refs/otomat/* is a read-only namespace: never a branch, so no Otomat operation holds a ref it could move.
  const headRef = `refs/otomat/pull/${input.number}/head`;
  const basePin = `refs/otomat/pull/${input.number}/base`;
  runGit(
    [
      "fetch",
      "--force",
      input.remote,
      `refs/pull/${input.number}/head:${headRef}`,
      `refs/heads/${input.baseRef}:${basePin}`,
    ],
    { cwd: input.repoRoot },
  );
  const head = revParse(input.repoRoot, headRef);
  const base = mergeBase(input.repoRoot, basePin, head);
  if (base === null) {
    throw new Error(`pull request #${input.number} shares no history with ${input.baseRef}`);
  }
  return { base, head };
}

/** Null rather than a guessed pair: this clone may hold neither the head nor a history it shares with the base. */
export function publishedPullRequestTrees(
  repoRoot: string,
  baseRef: string,
  head: string,
): PullRequestTrees | null {
  if (!hasCommit(repoRoot, head)) return null;
  const base = mergeBase(repoRoot, baseRef, head);
  return base === null ? null : { base, head };
}
