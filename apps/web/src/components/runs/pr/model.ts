import type { GitHubConnectionContract, PullRequestContract } from "@otomat/domain";

interface PullRequestViewModel {
  connectionLabel: string;
  showConnect: boolean;
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
  errorMessage: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export function pullRequestAcceptedSubmission(
  pullRequest: PullRequestContract | null,
  submission: { title: string; body: string },
): boolean {
  return (
    pullRequest !== null &&
    pullRequest.title === submission.title &&
    (pullRequest.body ?? "") === submission.body
  );
}

type PublicationModel = Pick<
  PullRequestViewModel,
  "actionLabel" | "actionDisabled" | "actionPending" | "stateLabel"
>;

const PENDING_PUBLICATION_MODELS = {
  pushing: {
    actionLabel: "Pushing branch…",
    actionDisabled: true,
    actionPending: true,
    stateLabel: "Pushing",
  },
  creating: {
    actionLabel: "Creating pull request…",
    actionDisabled: true,
    actionPending: true,
    stateLabel: "Creating",
  },
} as const satisfies Record<"pushing" | "creating", PublicationModel>;

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

function createdModel(
  pullRequest: PullRequestContract,
  hasDraftChanges: boolean,
): PublicationModel {
  if (hasDraftChanges || pullRequest.has_unpublished_changes === true) {
    return {
      actionLabel: "Update PR",
      actionDisabled: false,
      actionPending: false,
      stateLabel: "Unpublished changes",
    };
  }
  if (pullRequest.has_unpublished_changes === null) {
    return {
      actionLabel: "Retry comparison",
      actionDisabled: false,
      actionPending: false,
      stateLabel: "Changes unavailable",
    };
  }
  return {
    actionLabel: "Pull request up to date",
    actionDisabled: true,
    actionPending: false,
    stateLabel: "Up to date",
  };
}

function newModel(canPublish: boolean, connected: boolean): PublicationModel {
  const stateLabel = canPublish && connected ? "Ready to publish" : "Run not ready for publication";
  return {
    actionLabel: "Prepare PR",
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: canPublish && !connected ? "Not configured" : stateLabel,
  };
}

function terminalModel(status: "merged" | "closed"): PublicationModel {
  return {
    actionLabel: "Pull request complete",
    actionDisabled: true,
    actionPending: false,
    stateLabel: `PR ${status}`,
  };
}

function failedModel(pullRequest: PullRequestContract, canPublish: boolean): PublicationModel {
  const isCreation = pullRequest.number === null;
  return {
    actionLabel: isCreation ? "Retry PR" : "Update PR",
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: pullRequest.number === null ? "Creation failed" : "Update failed",
  };
}

function publicationModel(
  pullRequest: PullRequestContract | null,
  canPublish: boolean,
  connected: boolean,
  hasDraftChanges: boolean,
): PublicationModel {
  if (pullRequest === null) return newModel(canPublish, connected);
  if (pullRequest.status === "merged" || pullRequest.status === "closed") {
    return terminalModel(pullRequest.status);
  }
  if (pullRequest.publication_status === "pushing") return PENDING_PUBLICATION_MODELS.pushing;
  if (pullRequest.publication_status === "creating") return PENDING_PUBLICATION_MODELS.creating;
  if (pullRequest.publication_status === "created") {
    return createdModel(pullRequest, hasDraftChanges);
  }
  if (pullRequest.publication_status === "failed") return failedModel(pullRequest, canPublish);
  return {
    actionLabel: "Prepare PR",
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: "Not configured",
  };
}

export function pullRequestViewModel(
  connection: GitHubConnectionContract,
  pullRequest: PullRequestContract | null,
  canPublish = true,
  hasDraftChanges = false,
): PullRequestViewModel {
  const connected = connection.status === "connected";
  const providerLink = link(pullRequest);
  const publication = publicationModel(pullRequest, canPublish, connected, hasDraftChanges);
  return {
    connectionLabel: connectionLabel(connection),
    showConnect: connection.status === "disconnected" || connection.status === "failed",
    ...publication,
    actionDisabled: !connected || !canPublish || publication.actionDisabled,
    errorMessage: pullRequest?.error_message ?? connection.error_message,
    linkLabel: providerLink.label,
    linkUrl: providerLink.url,
  };
}
