import { RemoteBaseError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { repositoryRemotes, revParse } from "./repo.js";

interface RemoteBranch {
  remote: string;
  ref: string;
}

function config(repoPath: string, key: string): string | null {
  const result = runGit(["config", "--get", key], { cwd: repoPath, allowFailure: true });
  const value = result.stdout.trim();
  return result.exitCode === 0 && value !== "" ? value : null;
}

function resolveRemoteBranch(repoPath: string, branch: string, remotes: string[]): RemoteBranch {
  const configured = config(repoPath, `branch.${branch}.remote`);
  if (configured === null) {
    const [only, ...rest] = remotes;
    if (only === undefined || rest.length > 0) {
      throw new RemoteBaseError(
        `"${branch}" has no upstream in ${repoPath}; set its upstream, then relaunch.`,
      );
    }
    return { remote: only, ref: `refs/heads/${branch}` };
  }
  // git writes `.` for a branch tracking a local one; fetching it answers the operator's checkout.
  if (configured === ".") {
    throw new RemoteBaseError(
      `"${branch}" tracks the local repository, not a remote; retarget its upstream, then relaunch.`,
    );
  }
  return {
    remote: configured,
    ref: config(repoPath, `branch.${branch}.merge`) ?? `refs/heads/${branch}`,
  };
}

export function resolveBaseSha(repoPath: string, branch: string, allowLocal: boolean): string {
  const remotes = repositoryRemotes(repoPath);
  if (remotes.length === 0) {
    if (allowLocal) return revParse(repoPath, branch);
    throw new RemoteBaseError(
      `${repoPath} has no git remote to read "${branch}" from; add one, or launch from the local branch explicitly.`,
    );
  }
  const { remote, ref } = resolveRemoteBranch(repoPath, branch, remotes);
  const fetched = runGit(["fetch", "--no-tags", remote, ref], {
    cwd: repoPath,
    allowFailure: true,
  });
  // No other daemon work can move `FETCH_HEAD` before this read: the launch path is synchronous.
  if (fetched.exitCode === 0) return revParse(repoPath, "FETCH_HEAD");
  // `--exit-code` answers 2 only for a ref the remote never advertised: local-only work.
  const advertised = runGit(["ls-remote", "--exit-code", remote, ref], {
    cwd: repoPath,
    allowFailure: true,
  });
  if (advertised.exitCode === 2) return revParse(repoPath, branch);
  throw new RemoteBaseError(
    `"${branch}" could not be read from ${remote}: ${fetched.stderr.trim()}`,
  );
}

const REMOTE_PROBE_TIMEOUT_MS = 10_000;

export type RemoteBranchProbe =
  | { status: "reachable"; remote: string }
  | { status: "local_only"; remote: string }
  | { status: "no_remote" }
  | { status: "no_upstream" }
  | { status: "timed_out"; remote: string }
  | { status: "unreadable"; reason: string };

/** Reads with `ls-remote`, never `fetch`, so a diagnostic moves no ref, and forwards no output: a remote URL can carry a credential. */
export function probeRemoteBranch(repoPath: string, branch: string): RemoteBranchProbe {
  const remotes = repositoryRemotes(repoPath);
  if (remotes.length === 0) return { status: "no_remote" };

  let target: RemoteBranch;
  try {
    target = resolveRemoteBranch(repoPath, branch, remotes);
  } catch (error) {
    if (error instanceof RemoteBaseError) return { status: "no_upstream" };
    throw error;
  }

  const advertised = runGit(["ls-remote", "--exit-code", target.remote, target.ref], {
    cwd: repoPath,
    env: { GIT_TERMINAL_PROMPT: "0" },
    allowFailure: true,
    timeoutMs: REMOTE_PROBE_TIMEOUT_MS,
  });
  if (advertised.exitCode === 0) return { status: "reachable", remote: target.remote };
  if (advertised.exitCode === 2) return { status: "local_only", remote: target.remote };
  // A killed probe reports no exit code; only a timeout can kill this one.
  if (advertised.exitCode === null) return { status: "timed_out", remote: target.remote };
  return {
    status: "unreadable",
    reason: `"${branch}" could not be read from "${target.remote}" on this host.`,
  };
}
