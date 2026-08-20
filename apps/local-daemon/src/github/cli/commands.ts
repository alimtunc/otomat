import { GitHubCliError } from "../errors.js";
import type { CommandResult, CommandRunner, PullRequestCreateInput } from "../types.js";

export function commandSucceeded(result: CommandResult): boolean {
  return result.exitCode === 0 && !result.errorCode;
}

export function assertCommandSucceeded(result: CommandResult, code: string, message: string): void {
  if (!commandSucceeded(result)) throw new GitHubCliError(code, message);
}

/** Last output line of a failed command, bounded; null when it printed nothing. */
export function commandFailureDetail(result: CommandResult): string | null {
  const lastLine =
    (result.stderr.trim() || result.stdout.trim())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? "";
  if (lastLine !== "") return lastLine.slice(0, 200);
  return result.errorCode ?? null;
}

/** Publication failures carry gh's own reason; auth-path failures stay catalog-only so command output never reaches the auth contract. */
export function assertPublicationSucceeded(
  result: CommandResult,
  code: string,
  message: string,
): void {
  if (commandSucceeded(result)) return;
  const detail = commandFailureDetail(result);
  throw new GitHubCliError(code, detail === null ? message : `${message} (${detail})`);
}

const CREATE_RETRY_DELAYS_MS = [2_000, 4_000];

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function attemptCreate(run: CommandRunner, input: PullRequestCreateInput): Promise<CommandResult> {
  return run({
    command: "gh",
    args: [
      "pr",
      "create",
      "--repo",
      input.repository,
      "--base",
      input.base,
      "--head",
      input.head,
      "--title",
      input.title,
      "--body-file",
      "-",
      ...(input.draft ? ["--draft"] : []),
    ],
    cwd: input.cwd,
    stdin: input.body,
  });
}

/** A branch pushed an instant earlier can lag GitHub-side; bounded retries absorb that race before failing honestly. */
export async function createPullRequestWithRetry(
  run: CommandRunner,
  sleep: (ms: number) => Promise<void>,
  input: PullRequestCreateInput,
): Promise<void> {
  let createResult = await attemptCreate(run, input);
  for (const delay of CREATE_RETRY_DELAYS_MS) {
    if (commandSucceeded(createResult)) return;
    console.error(
      `[otomat] gh pr create failed (${commandFailureDetail(createResult) ?? "no output"}); retrying in ${delay}ms`,
    );
    await sleep(delay);
    createResult = await attemptCreate(run, input);
  }
  assertPublicationSucceeded(
    createResult,
    "github_pr_create_failed",
    "GitHub could not create the pull request.",
  );
}
