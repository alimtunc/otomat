import {
  PULL_REQUEST_PUBLICATION_MODES,
  type GitHubConnectionContract,
  type PullRequestContract,
  type PullRequestPublicationMode,
} from "@otomat/domain";

export interface PullRequestViewModel {
  connectionLabel: string;
  showConnect: boolean;
  deviceAuthorization: { code: string; url: string } | null;
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
  errorMessage: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export function isPullRequestPublicationMode(value: string): value is PullRequestPublicationMode {
  return (PULL_REQUEST_PUBLICATION_MODES as readonly string[]).includes(value);
}

/** How GitHub currently holds the pull request; a merged or closed one is past the draft/ready question. */
function publishedMode(pullRequest: PullRequestContract): PullRequestPublicationMode | null {
  if (pullRequest.status === "draft") return "draft";
  if (pullRequest.status === "open") return "ready";
  return null;
}

/** What the form starts on: the mode GitHub already holds, else a draft. */
export function initialPublicationMode(
  pullRequest: PullRequestContract | null,
): PullRequestPublicationMode {
  if (pullRequest === null) return "draft";
  return publishedMode(pullRequest) ?? "draft";
}

/** Accepted only when GitHub reports back exactly what was submitted, mode included. */
export function pullRequestAcceptedSubmission(
  pullRequest: PullRequestContract | null,
  submission: { title: string; body: string; mode: PullRequestPublicationMode },
): boolean {
  if (pullRequest === null) return false;
  if (pullRequest.title !== submission.title) return false;
  if ((pullRequest.body ?? "") !== submission.body) return false;
  const mode = publishedMode(pullRequest);
  return mode === null || mode === submission.mode;
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
  if (connection.status === "connecting") {
    return connection.device_authorization
      ? "Waiting for GitHub sign-in…"
      : "Connecting to GitHub…";
  }
  if (connection.status === "not_installed") return "GitHub CLI not installed";
  if (connection.status === "cli_outdated") return "GitHub CLI too old";
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

/** The action says which of the two publications it will perform, so the choice is never implicit. */
function createLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR" : "Create PR ready for review";
}

function newModel(
  canPublish: boolean,
  connected: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  const stateLabel = canPublish && connected ? "Ready to publish" : "Run not ready for publication";
  return {
    actionLabel: createLabel(mode),
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
  mode: PullRequestPublicationMode,
): PublicationModel {
  if (pullRequest === null) return newModel(canPublish, connected, mode);
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
    actionLabel: createLabel(mode),
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
  mode: PullRequestPublicationMode = "draft",
): PullRequestViewModel {
  const connected = connection.status === "connected";
  const providerLink = link(pullRequest);
  const publication = publicationModel(pullRequest, canPublish, connected, hasDraftChanges, mode);
  const device = connection.device_authorization;
  return {
    connectionLabel: connectionLabel(connection),
    showConnect: connection.status === "disconnected" || connection.status === "failed",
    deviceAuthorization: device ? { code: device.user_code, url: device.verification_url } : null,
    ...publication,
    actionDisabled: !connected || !canPublish || publication.actionDisabled,
    errorMessage: pullRequest?.error_message ?? connection.error_message,
    linkLabel: providerLink.label,
    linkUrl: providerLink.url,
  };
}
