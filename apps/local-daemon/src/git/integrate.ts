import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { WorkspaceUpdateStrategy } from "@otomat/domain";

import { IntegrationAbortedError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { verifyRef } from "./repo.js";

/** Hooks run during both; bounded so a hung hook cannot hold the checkout lock forever. */
const INTEGRATE_TIMEOUT_MS = 120_000;

async function unmergedPaths(worktreePath: string): Promise<string[]> {
  const { stdout } = await runGit(["diff", "--name-only", "--diff-filter=U", "-z"], {
    cwd: worktreePath,
  });
  return stdout.split("\0").filter((path) => path !== "");
}

async function gitPathExists(worktreePath: string, name: string): Promise<boolean> {
  const { stdout } = await runGit(["rev-parse", "--git-path", name], { cwd: worktreePath });
  return existsSync(resolve(worktreePath, stdout.trim()));
}

async function inProgress(
  worktreePath: string,
  strategy: WorkspaceUpdateStrategy,
): Promise<boolean> {
  if (strategy === "merge") return (await verifyRef(worktreePath, "MERGE_HEAD")) !== null;
  return (
    (await gitPathExists(worktreePath, "rebase-merge")) ||
    (await gitPathExists(worktreePath, "rebase-apply"))
  );
}

export async function integrateCommit(
  worktreePath: string,
  sha: string,
  strategy: WorkspaceUpdateStrategy,
  mergeMessage: string,
): Promise<void> {
  const args =
    strategy === "rebase" ? ["rebase", sha] : ["merge", "--no-edit", "-m", mergeMessage, sha];
  const result = await runGit(args, {
    cwd: worktreePath,
    allowFailure: true,
    timeoutMs: INTEGRATE_TIMEOUT_MS,
  });
  if (result.exitCode === 0) return;
  const conflicts = await unmergedPaths(worktreePath);
  if (await inProgress(worktreePath, strategy)) {
    await runGit([strategy, "--abort"], { cwd: worktreePath });
  }
  throw new IntegrationAbortedError(conflicts, result.stderr);
}
