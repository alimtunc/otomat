import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type { PullRequestMergeInput } from "./contract.js";

const METHOD_FLAG = { merge: "--merge", squash: "--squash" } as const;

export async function mergePullRequest(
  run: CommandRunner,
  input: PullRequestMergeInput,
): Promise<void> {
  const result = await run({
    command: "gh",
    args: [
      "pr",
      "merge",
      String(input.number),
      "--repo",
      input.repository,
      METHOD_FLAG[input.method],
    ],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_pr_merge_failed",
    "GitHub refused to merge the pull request.",
  );
}
