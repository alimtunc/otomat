import {
  assertPublicationSucceeded,
  commandFailureDetail,
  commandSucceeded,
} from "./cli-commands.js";
import { GitHubCliError } from "./errors.js";
import { maskRemoteUrl, parseGitHubRemoteUrl } from "./parse.js";
import type { CommandRunner, ForcePushWithLeaseInput, GitHubRemote } from "./types.js";

const NON_FAST_FORWARD = /non-fast-forward|fetch first|Updates were rejected/i;
const STALE_LEASE = /stale info/i;

interface RemoteRefusal {
  name: string;
  reason: string;
}

function noUsableRemote(cwd: string, refused: RemoteRefusal[]): GitHubCliError {
  if (refused.length === 0) {
    return new GitHubCliError(
      "github_remote_missing",
      `No git remote is configured in ${cwd}; add a GitHub remote named origin, then retry.`,
    );
  }
  const listed = refused.map((refusal) => `${refusal.name} (${refusal.reason})`).join(", ");
  return new GitHubCliError(
    "github_remote_missing",
    `No usable GitHub remote was found for this run in ${cwd}: ${listed}. Point origin at a GitHub repository, then retry.`,
  );
}

function selectRemote(
  cwd: string,
  candidates: GitHubRemote[],
  refused: RemoteRefusal[],
): GitHubRemote {
  const origin = candidates.find((candidate) => candidate.name === "origin");
  if (origin) return origin;
  const [onlyCandidate] = candidates;
  if (onlyCandidate && candidates.length === 1) return onlyCandidate;
  if (!onlyCandidate) throw noUsableRemote(cwd, refused);
  throw new GitHubCliError(
    "github_remote_ambiguous",
    `More than one GitHub remote is available (${candidates.map((candidate) => candidate.name).join(", ")}); configure origin explicitly.`,
  );
}

export async function resolveRemote(run: CommandRunner, cwd: string): Promise<GitHubRemote> {
  const names = await run({ command: "git", args: ["remote"], cwd });
  assertPublicationSucceeded(
    names,
    "git_remote_list_failed",
    `Git remotes could not be read in ${cwd}.`,
  );
  const candidates: GitHubRemote[] = [];
  const refused: RemoteRefusal[] = [];
  for (const line of names.stdout.split("\n")) {
    const name = line.trim();
    if (name === "") continue;
    const remoteResult = await run({
      command: "git",
      args: ["remote", "get-url", "--push", name],
      cwd,
    });
    // Nothing is written to this command's stdin, so its exit code alone judges the URL it printed.
    if (remoteResult.exitCode !== 0) {
      refused.push({
        name,
        reason: `push URL unreadable: ${commandFailureDetail(remoteResult) ?? "no output"}`,
      });
      continue;
    }
    const url = remoteResult.stdout.trim();
    const parsed = parseGitHubRemoteUrl(url);
    if (parsed) candidates.push({ name, repository: parsed.repository });
    else refused.push({ name, reason: `${maskRemoteUrl(url)} is not a GitHub repository URL` });
  }
  return selectRemote(cwd, candidates, refused);
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
