import type { GitHubConnectionContract, ProjectHealthOutcome } from "@otomat/domain";

import type { GitHubService } from "#github";

type GitHubFailureStatus = Exclude<GitHubConnectionContract["status"], "connected">;

interface GitHubFailureCopy {
  message: string;
  remediation: string;
}

/** `failed` is null on purpose: only the CLI's own refusal says why, and it carries no credential. */
const FAILURES = {
  not_installed: {
    message: "The GitHub CLI is not installed on this host, so no pull request can be opened.",
    remediation: "Install the GitHub CLI (gh) on this host.",
  },
  cli_outdated: {
    message: "The GitHub CLI on this host is too old for the commands Otomat runs.",
    remediation: "Upgrade the GitHub CLI (gh) on this host.",
  },
  disconnected: {
    message: "The GitHub CLI on this host is not signed in, so no pull request can be opened.",
    remediation: "Connect GitHub on this host from Settings · Integrations.",
  },
  connecting: {
    message: "A GitHub device authorization is still pending on this host.",
    remediation: "Finish the device authorization from Settings · Integrations.",
  },
  failed: null,
} satisfies Record<GitHubFailureStatus, GitHubFailureCopy | null>;

function failure(status: GitHubFailureStatus, errorMessage: string | null): ProjectHealthOutcome {
  const known = FAILURES[status];
  return {
    status: status === "connecting" ? "warning" : "error",
    message: known?.message ?? errorMessage ?? "This host's GitHub CLI was refused.",
    remediation: known?.remediation ?? "Reconnect GitHub on this host.",
  };
}

export async function githubCheck(github: GitHubService): Promise<ProjectHealthOutcome> {
  const connection = await github.connection();
  if (connection.status !== "connected") {
    return failure(connection.status, connection.error_message);
  }
  return {
    status: "ready",
    message: `Signed in on this host as ${connection.login ?? "an authenticated user"}.`,
    remediation: null,
  };
}
