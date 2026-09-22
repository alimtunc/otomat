import { randomUUID } from "node:crypto";

import { redactLogText, type RemoteBaseFailure } from "@otomat/domain";

import { RemoteBaseError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { repositoryRemotes, revParse } from "./repo.js";

interface RemoteBranch {
  remote: string;
  ref: string;
}

/** A credential prompt would never be answered: an unauthenticated remote must fail so it can be classified. */
const NO_PROMPT_ENV = { GIT_TERMINAL_PROMPT: "0" };

const UNREACHABLE =
  /could not resolve host|name or service not known|nodename nor servname|temporary failure in name resolution|connection (?:refused|reset)|network is unreachable|no route to host|failed to connect|timed out/i;
const ACCESS_DENIED =
  /permission denied|authentication failed|could not read (?:username|password)|host key verification failed|returned error: 40[13]|access denied|invalid username or password/i;
const NOT_FOUND =
  /repository not found|does not appear to be a git repository|couldn't find remote ref|returned error: 404/i;

type FetchFailure = Exclude<RemoteBaseFailure, "no_upstream">;

export function classifyRemoteFailure(stderr: string): FetchFailure {
  if (UNREACHABLE.test(stderr)) return "unreachable";
  if (ACCESS_DENIED.test(stderr)) return "access_denied";
  if (NOT_FOUND.test(stderr)) return "not_found";
  return "unclassified";
}

const FAILURE_MESSAGE = {
  unreachable: (branch, remote) =>
    `"${remote}" could not be reached to read "${branch}"; check this host's network connection and DNS, then retry.`,
  access_denied: (branch, remote) =>
    `"${remote}" refused access while reading "${branch}"; check the credentials or SSH key this host uses for it, then retry.`,
  not_found: (branch, remote) =>
    `"${branch}" could not be found on "${remote}"; check that the remote and the branch still exist, then retry.`,
  unclassified: (branch, remote) =>
    `"${branch}" could not be read from "${remote}"; see the details, fix the remote, then retry.`,
} satisfies Record<FetchFailure, (branch: string, remote: string) => string>;

function noUpstream(message: string): RemoteBaseError {
  return new RemoteBaseError(message, { failure: "no_upstream", detail: null });
}

async function config(repoPath: string, key: string): Promise<string | null> {
  const result = await runGit(["config", "--get", key], { cwd: repoPath, allowFailure: true });
  const value = result.stdout.trim();
  return result.exitCode === 0 && value !== "" ? value : null;
}

async function resolveRemoteBranch(
  repoPath: string,
  branch: string,
  remotes: string[],
): Promise<RemoteBranch> {
  const configured = await config(repoPath, `branch.${branch}.remote`);
  if (configured === null) {
    const [only, ...rest] = remotes;
    if (only === undefined || rest.length > 0) {
      throw noUpstream(
        `"${branch}" has no upstream in ${repoPath}; set its upstream, then relaunch.`,
      );
    }
    return { remote: only, ref: `refs/heads/${branch}` };
  }
  // git writes `.` for a branch tracking a local one; fetching it answers the operator's checkout.
  if (configured === ".") {
    throw noUpstream(
      `"${branch}" tracks the local repository, not a remote; retarget its upstream, then relaunch.`,
    );
  }
  return {
    remote: configured,
    ref: (await config(repoPath, `branch.${branch}.merge`)) ?? `refs/heads/${branch}`,
  };
}

export async function resolveBaseSha(
  repoPath: string,
  branch: string,
  allowLocal: boolean,
): Promise<string> {
  const remotes = await repositoryRemotes(repoPath);
  if (remotes.length === 0) {
    if (allowLocal) return revParse(repoPath, branch);
    throw noUpstream(
      `${repoPath} has no git remote to read "${branch}" from; add one, or launch from the local branch explicitly.`,
    );
  }
  const { remote, ref } = await resolveRemoteBranch(repoPath, branch, remotes);
  // Any concurrent fetch in this repository rewrites `FETCH_HEAD`, so the fetched tip lands on a ref of its own.
  const landed = `refs/otomat/launch/${randomUUID()}`;
  const fetched = await runGit(["fetch", "--no-tags", remote, `+${ref}:${landed}`], {
    cwd: repoPath,
    env: NO_PROMPT_ENV,
    allowFailure: true,
  });
  if (fetched.exitCode === 0) {
    const sha = await revParse(repoPath, landed);
    await runGit(["update-ref", "-d", landed], { cwd: repoPath });
    return sha;
  }
  // `--exit-code` answers 2 only for a ref the remote never advertised: local-only work.
  const advertised = await runGit(["ls-remote", "--exit-code", remote, ref], {
    cwd: repoPath,
    env: NO_PROMPT_ENV,
    allowFailure: true,
  });
  if (advertised.exitCode === 2) return revParse(repoPath, branch);
  const failure = classifyRemoteFailure(fetched.stderr);
  const detail = redactLogText(fetched.stderr).trim();
  throw new RemoteBaseError(FAILURE_MESSAGE[failure](branch, remote), {
    failure,
    detail: detail === "" ? null : detail,
  });
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
export async function probeRemoteBranch(
  repoPath: string,
  branch: string,
): Promise<RemoteBranchProbe> {
  const remotes = await repositoryRemotes(repoPath);
  if (remotes.length === 0) return { status: "no_remote" };

  let target: RemoteBranch;
  try {
    target = await resolveRemoteBranch(repoPath, branch, remotes);
  } catch (error) {
    if (error instanceof RemoteBaseError) return { status: "no_upstream" };
    throw error;
  }

  const advertised = await runGit(["ls-remote", "--exit-code", target.remote, target.ref], {
    cwd: repoPath,
    env: NO_PROMPT_ENV,
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
