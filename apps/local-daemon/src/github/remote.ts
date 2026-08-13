import { assertPublicationSucceeded, commandSucceeded } from "./cli-commands.js";
import { GitHubCliError } from "./errors.js";
import { parseGitHubRemoteUrl, selectRemote } from "./parse.js";
import type { CommandRunner, ForcePushWithLeaseInput, GitHubRemote } from "./types.js";

const NON_FAST_FORWARD = /non-fast-forward|fetch first|Updates were rejected/i;
const STALE_LEASE = /stale info/i;

export async function resolveRemote(run: CommandRunner, cwd: string): Promise<GitHubRemote> {
  const names = await run({ command: "git", args: ["remote"], cwd });
  assertPublicationSucceeded(names, "git_remote_list_failed", "Git remotes could not be read.");
  const candidates: GitHubRemote[] = [];
  for (const line of names.stdout.split("\n")) {
    const name = line.trim();
    if (name === "") continue;
    const remoteResult = await run({
      command: "git",
      args: ["remote", "get-url", "--push", name],
      cwd,
    });
    if (!commandSucceeded(remoteResult)) continue;
    const parsed = parseGitHubRemoteUrl(remoteResult.stdout.trim());
    if (parsed) candidates.push({ name, repository: parsed.repository });
  }
  return selectRemote(candidates);
}

/** A rejected fast-forward gets its own code: it is the one push failure the cockpit can offer a lease for. */
export async function push(
  run: CommandRunner,
  cwd: string,
  remote: string,
  branch: string,
): Promise<void> {
  const result = await run({
    command: "git",
    args: ["push", "--no-verify", "--set-upstream", remote, `HEAD:refs/heads/${branch}`],
    cwd,
  });
  if (commandSucceeded(result)) return;
  if (NON_FAST_FORWARD.test(result.stderr)) {
    throw new GitHubCliError(
      "github_push_rejected",
      `GitHub rejected the push to ${branch}: the remote branch has commits this workspace does not.`,
    );
  }
  assertPublicationSucceeded(
    result,
    "github_push_failed",
    "The run branch could not be pushed to GitHub.",
  );
}

export async function forcePushWithLease(
  run: CommandRunner,
  input: ForcePushWithLeaseInput,
): Promise<void> {
  const result = await run({
    command: "git",
    args: [
      "push",
      "--no-verify",
      `--force-with-lease=refs/heads/${input.branch}:${input.expectedRemoteSha}`,
      input.remote,
      `HEAD:refs/heads/${input.branch}`,
    ],
    cwd: input.cwd,
  });
  if (commandSucceeded(result)) return;
  if (STALE_LEASE.test(result.stderr) || NON_FAST_FORWARD.test(result.stderr)) {
    throw new GitHubCliError(
      "github_push_lease_stale",
      `${input.branch} moved on GitHub since it was read, so nothing was overwritten. Refresh the comparison and confirm again.`,
    );
  }
  assertPublicationSucceeded(
    result,
    "github_force_push_failed",
    "The run branch could not be force-pushed to GitHub.",
  );
}

export async function remoteHead(
  run: CommandRunner,
  cwd: string,
  remote: string,
  branch: string,
): Promise<string | null> {
  const result = await run({
    command: "git",
    args: ["ls-remote", "--exit-code", remote, `refs/heads/${branch}`],
    cwd,
  });
  // `--exit-code` answers 2 for "no such ref", which is a branch that is simply absent, not a failure.
  if (result.exitCode === 2) return null;
  assertPublicationSucceeded(
    result,
    "github_remote_head_failed",
    `The remote head of ${branch} could not be read.`,
  );
  const sha = result.stdout.trim().split(/\s+/)[0] ?? "";
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new GitHubCliError(
      "github_remote_head_failed",
      `The remote head of ${branch} could not be read.`,
    );
  }
  return sha;
}

export async function fetchBranch(
  run: CommandRunner,
  cwd: string,
  remote: string,
  branch: string,
): Promise<void> {
  const result = await run({
    command: "git",
    args: ["fetch", "--no-tags", remote, `refs/heads/${branch}`],
    cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_fetch_failed",
    `The remote branch ${branch} could not be fetched.`,
  );
}
