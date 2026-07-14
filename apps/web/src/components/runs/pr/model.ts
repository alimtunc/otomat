import type { GitHubConnectionContract, PullRequestContract } from "@otomat/domain";

export type PullRequestAction = "prepare" | "update" | "none";

export interface PullRequestViewModel {
  connectionLabel: string;
  showConnect: boolean;
  action: PullRequestAction;
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
  errorMessage: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

function connectionLabel(connection: GitHubConnectionContract): string {
  if (connection.status === "connected") return `Connected as ${connection.login ?? "GitHub user"}`;
  if (connection.status === "connecting") return "Connecting to GitHub…";
  if (connection.status === "not_installed") return "GitHub CLI not installed";
  if (connection.status === "failed") return "GitHub connection failed";
  return "GitHub not connected";
}

function link(pullRequest: PullRequestContract | null): {
  label: string | null;
  url: string | null;
} {
  if (pullRequest?.number === null || pullRequest?.number === undefined || !pullRequest.url) {
    return { label: null, url: null };
  }
  return { label: `Open PR #${pullRequest.number}`, url: pullRequest.url };
}

export function pullRequestViewModel(
  connection: GitHubConnectionContract,
  pullRequest: PullRequestContract | null,
): PullRequestViewModel {
  const connected = connection.status === "connected";
  const providerLink = link(pullRequest);
  const base = {
    connectionLabel: connectionLabel(connection),
    showConnect: connection.status === "disconnected" || connection.status === "failed",
    actionDisabled: !connected,
    actionPending: false,
    errorMessage: pullRequest?.error_message ?? connection.error_message,
    linkLabel: providerLink.label,
    linkUrl: providerLink.url,
  };

  if (pullRequest === null) {
    return {
      ...base,
      action: "prepare",
      actionLabel: "Prepare PR",
      stateLabel: connected ? "Ready to publish" : "Not configured",
    };
  }
  if (pullRequest.status === "merged" || pullRequest.status === "closed") {
    return {
      ...base,
      action: "none",
      actionLabel: "Pull request complete",
      actionDisabled: true,
      stateLabel: `PR ${pullRequest.status}`,
    };
  }
  if (pullRequest.publication_status === "pushing") {
    return {
      ...base,
      action: "none",
      actionLabel: "Pushing branch…",
      actionDisabled: true,
      actionPending: true,
      stateLabel: "Pushing",
    };
  }
  if (pullRequest.publication_status === "creating") {
    return {
      ...base,
      action: "none",
      actionLabel: "Creating pull request…",
      actionDisabled: true,
      actionPending: true,
      stateLabel: "Creating",
    };
  }
  if (pullRequest.publication_status === "failed") {
    const action = pullRequest.number === null ? "prepare" : "update";
    return {
      ...base,
      action,
      actionLabel: action === "prepare" ? "Retry PR" : "Update PR",
      stateLabel: pullRequest.number === null ? "Creation failed" : "Update failed",
    };
  }
  if (pullRequest.publication_status === "created") {
    if (pullRequest.has_unpublished_changes === null) {
      return {
        ...base,
        action: "update",
        actionLabel: "Retry comparison",
        stateLabel: "Changes unavailable",
      };
    }
    return pullRequest.has_unpublished_changes
      ? {
          ...base,
          action: "update",
          actionLabel: "Update PR",
          stateLabel: "Unpublished changes",
        }
      : {
          ...base,
          action: "none",
          actionLabel: "Pull request up to date",
          stateLabel: "Up to date",
        };
  }
  return {
    ...base,
    action: "prepare",
    actionLabel: "Prepare PR",
    stateLabel: "Not configured",
  };
}
