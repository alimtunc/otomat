import { runGit } from "./git-cli.js";
import { tryRealpath } from "./probe.js";

/** Resolves a ref (branch, tag, sha, `<ref>^{tree}`, ...) to its object id. */
export async function revParse(repoPath: string, ref: string): Promise<string> {
  return (await runGit(["rev-parse", ref], { cwd: repoPath })).stdout.trim();
}

/** Current `HEAD` commit sha of the repo or worktree at `repoPath`. */
export function headSha(repoPath: string): Promise<string> {
  return revParse(repoPath, "HEAD");
}

/** Short symbolic name of the checked-out branch (e.g. `main`). */
export async function currentBranch(repoPath: string): Promise<string> {
  return (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath })).stdout.trim();
}

/** Best common ancestor of two refs, or `null` when histories are unrelated. */
export async function mergeBase(repoPath: string, a: string, b: string): Promise<string | null> {
  const res = await runGit(["merge-base", a, b], { cwd: repoPath, allowFailure: true });
  if (res.exitCode !== 0) return null;
  const sha = res.stdout.trim();
  return sha === "" ? null : sha;
}

export async function verifyRef(repoPath: string, rev: string): Promise<string | null> {
  const res = await runGit(["rev-parse", "--verify", "--quiet", rev], {
    cwd: repoPath,
    allowFailure: true,
  });
  const sha = res.stdout.trim();
  return res.exitCode === 0 && sha !== "" ? sha : null;
}

/** A base branch with no tracking config still has a published side when the repo has one remote. */
async function publishedBase(repoPath: string, branch: string): Promise<string | null> {
  const remote = await runGit(["config", "--get", `branch.${branch}.remote`], {
    cwd: repoPath,
    allowFailure: true,
  });
  // git writes `.` for a branch tracking a local one, which publishes nothing.
  if (remote.stdout.trim() === ".") return null;
  const tracked = await verifyRef(repoPath, `${branch}@{upstream}`);
  if (tracked !== null) return tracked;
  const [only, ...rest] = await repositoryRemotes(repoPath);
  if (only === undefined || rest.length > 0) return null;
  return verifyRef(repoPath, `refs/remotes/${only}/${branch}`);
}

/** Later of the local and published fork points: a clone whose base branch lags the remote reports one behind. */
export async function baseBranchForkPoint(
  repoPath: string,
  branch: string,
  ref: string,
): Promise<string | null> {
  const local = await mergeBase(repoPath, branch, ref);
  const upstream = await publishedBase(repoPath, branch);
  if (upstream === null) return local;
  const published = await mergeBase(repoPath, upstream, ref);
  if (local === null || published === null) return local ?? published;
  // A published side that already contains `ref` collapses onto it, which would read as an empty diff.
  if (published === (await revParse(repoPath, ref))) return local;
  return (await isAncestor(repoPath, local, published)) ? published : local;
}

/** Whether the object store already holds `sha` as a commit — a remote sha it lacks cannot be compared without fetching. */
export async function hasCommit(repoPath: string, sha: string): Promise<boolean> {
  const res = await runGit(["cat-file", "-e", `${sha}^{commit}`], {
    cwd: repoPath,
    allowFailure: true,
  });
  return res.exitCode === 0;
}

export async function isAncestor(
  repoPath: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const res = await runGit(["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repoPath,
    allowFailure: true,
  });
  return res.exitCode === 0;
}

export async function fastForward(repoPath: string, ref: string): Promise<void> {
  await runGit(["merge", "--ff-only", ref], { cwd: repoPath });
}

/** The repo's current branch, or null when `repoPath` is not a git work tree or HEAD is detached. */
export async function detectDefaultBranch(repoPath: string): Promise<string | null> {
  const probe = await runGit(["rev-parse", "--is-inside-work-tree"], {
    cwd: repoPath,
    allowFailure: true,
  });
  if (probe.exitCode !== 0 || probe.stdout.trim() !== "true") return null;
  const branch = await currentBranch(repoPath);
  return branch === "" || branch === "HEAD" ? null : branch;
}

export async function repositoryRemotes(repoPath: string): Promise<string[]> {
  const res = await runGit(["remote"], { cwd: repoPath, allowFailure: true });
  if (res.exitCode !== 0) return [];
  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Whether `repoPath` is still the root of a git repository. Deliberately weaker
 * than {@link probeLocalRepository}: forking a worktree needs a repository root,
 * not the attached HEAD that registration insists on.
 */
export async function isRepositoryRoot(repoPath: string): Promise<boolean> {
  const canonical = tryRealpath(repoPath);
  if (canonical === null) return false;
  // `git` cannot even be spawned in a directory that vanished or is unreadable,
  // which is the same answer as "not a repository root", not a daemon failure.
  let toplevel: string;
  try {
    const result = await runGit(["rev-parse", "--show-toplevel"], {
      cwd: canonical,
      allowFailure: true,
    });
    if (result.exitCode !== 0) return false;
    toplevel = result.stdout.trim();
  } catch {
    return false;
  }
  return toplevel !== "" && tryRealpath(toplevel) === canonical;
}

/** Commits only this branch holds, so deleting it loses them; `null` when git cannot answer. */
export async function unpushedCommitCount(
  repoPath: string,
  branch: string,
): Promise<number | null> {
  const res = await runGit(
    ["rev-list", "--count", branch, "--not", `--exclude=${branch}`, "--branches", "--remotes"],
    {
      cwd: repoPath,
      allowFailure: true,
    },
  );
  if (res.exitCode !== 0) return null;
  const count = Number.parseInt(res.stdout.trim(), 10);
  return Number.isNaN(count) ? null : count;
}

export interface CommitSummary {
  sha: string;
  subject: string;
  authorName: string;
  /** Author date in ISO-8601, as git itself formats it. */
  authoredAt: string;
}

// The unit separator: a commit subject can hold anything a tab or a pipe could.
const FIELD_SEPARATOR = "\x1f";
const COMMIT_FORMAT = "--format=%H%x1f%s%x1f%an%x1f%aI";

function parseCommitLines(stdout: string): CommitSummary[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [sha = "", subject = "", authorName = "", authoredAt = ""] =
        line.split(FIELD_SEPARATOR);
      return { sha, subject, authorName, authoredAt };
    });
}

/** Newest first. An unreadable range throws rather than reporting an empty branch. */
export async function commitsSince(
  repoPath: string,
  base: string,
  ref: string,
): Promise<CommitSummary[]> {
  return parseCommitLines(
    (await runGit(["log", COMMIT_FORMAT, `${base}..${ref}`], { cwd: repoPath })).stdout,
  );
}

export async function commitSummary(repoPath: string, ref: string): Promise<CommitSummary | null> {
  const res = await runGit(["log", "-1", COMMIT_FORMAT, `${ref}^{commit}`], {
    cwd: repoPath,
    allowFailure: true,
  });
  if (res.exitCode !== 0) return null;
  return parseCommitLines(res.stdout)[0] ?? null;
}

export function commitParent(repoPath: string, commit: string): Promise<string | null> {
  return verifyRef(repoPath, `${commit}^`);
}

/** A boundary tree is a loose object git may prune, so a pass's delta must check before diffing. */
export async function hasTree(repoPath: string, sha: string): Promise<boolean> {
  const res = await runGit(["cat-file", "-e", `${sha}^{tree}`], {
    cwd: repoPath,
    allowFailure: true,
  });
  return res.exitCode === 0;
}

/** Paths carrying uncommitted work — staged, unstaged or untracked — in the worktree at `repoPath`. */
export async function uncommittedPaths(repoPath: string): Promise<string[]> {
  return (await runGit(["--no-optional-locks", "status", "--porcelain"], { cwd: repoPath })).stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.slice(3));
}

export interface TrackedFileMatches {
  paths: string[];
  omitted: number;
}

/** Tracked paths containing `query` (case-insensitive), capped at `limit` with the overflow counted rather than hidden. */
export async function searchTrackedFiles(
  repoPath: string,
  query: string,
  limit: number,
): Promise<TrackedFileMatches> {
  const needle = query.trim().toLowerCase();
  const tracked = (
    await runGit(["-c", "core.quotepath=false", "ls-files", "-z"], { cwd: repoPath })
  ).stdout
    .split("\0")
    .filter((path) => path !== "");
  const matched =
    needle === "" ? tracked : tracked.filter((path) => path.toLowerCase().includes(needle));
  return { paths: matched.slice(0, limit), omitted: Math.max(0, matched.length - limit) };
}
