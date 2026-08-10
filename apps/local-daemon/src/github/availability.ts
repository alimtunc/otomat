import type { GitHubConnectionContract } from "@otomat/domain";

import { commandSucceeded } from "./cli-commands.js";
import { connectionProblem, MINIMUM_GH_VERSION, outdatedGhVersion } from "./parse.js";
import type { CommandRunner } from "./types.js";

export async function cliAvailability(
  run: CommandRunner,
): Promise<GitHubConnectionContract | null> {
  const version = await run({ command: "gh", args: ["--version"], cwd: process.cwd() });
  if (version.errorCode === "ENOENT") {
    return connectionProblem(
      "not_installed",
      "github_cli_missing",
      "Install GitHub CLI to connect Otomat to GitHub.",
    );
  }
  if (!commandSucceeded(version)) {
    return connectionProblem("failed", "github_cli_failed", "GitHub CLI could not be started.");
  }
  const outdated = outdatedGhVersion(version.stdout);
  if (outdated) {
    return connectionProblem(
      "cli_outdated",
      "github_cli_outdated",
      `GitHub CLI ${outdated} is too old; Otomat needs ${MINIMUM_GH_VERSION} or newer.`,
    );
  }
  return null;
}
