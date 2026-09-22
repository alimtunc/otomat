import { serializeByKey } from "#serialize";

import { runGit } from "./git-cli.js";
import { baseBranchForkPoint, hasCommit, mergeBase, revParse } from "./repo.js";

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

/** Longer than a probe's bound: a fetch transfers the pull request's objects, a probe only lists refs. */
const PULL_REQUEST_FETCH_TIMEOUT_MS = 60_000;

const fetches = new Map<string, Promise<unknown>>();

/** Re-fetching is how a moved head is picked up, so the head ref is forced. */
export function fetchPullRequestTrees(input: PullRequestFetchInput): Promise<PullRequestTrees> {
  // refs/otomat/* is a read-only namespace: never a branch, so no Otomat operation holds a ref it could move.
  const headRef = `refs/otomat/pull/${input.number}/head`;
  const basePin = `refs/otomat/pull/${input.number}/base`;
  // Two fetches of one pull request contend for the same ref locks.
  return serializeByKey(fetches, `${input.repoRoot}\0${headRef}`, async () => {
    await runGit(
      [
        "fetch",
        "--force",
        input.remote,
        `refs/pull/${input.number}/head:${headRef}`,
        `refs/heads/${input.baseRef}:${basePin}`,
      ],
      { cwd: input.repoRoot, timeoutMs: PULL_REQUEST_FETCH_TIMEOUT_MS },
    );
    const head = await revParse(input.repoRoot, headRef);
    const base = await mergeBase(input.repoRoot, basePin, head);
    if (base === null) {
      throw new Error(`pull request #${input.number} shares no history with ${input.baseRef}`);
    }
    return { base, head };
  });
}

/** Null rather than a guessed pair: this clone may hold neither the head nor a history it shares with the base. */
export async function publishedPullRequestTrees(
  repoRoot: string,
  baseRef: string,
  head: string,
): Promise<PullRequestTrees | null> {
  if (!(await hasCommit(repoRoot, head))) return null;
  const base = await baseBranchForkPoint(repoRoot, baseRef, head);
  return base === null ? null : { base, head };
}
