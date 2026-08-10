import {
  PULL_REQUEST_PUBLICATION_MODES,
  type GitHubConnectionContract,
  type PullRequestContract,
  type PullRequestPublicationMode,
} from "@otomat/domain";

import { publicationModel } from "./publication-model";

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
