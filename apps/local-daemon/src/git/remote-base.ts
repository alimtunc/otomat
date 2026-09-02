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
