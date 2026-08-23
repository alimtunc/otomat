import {
  PULL_REQUEST_PUBLICATION_MODES,
  type GitHubConnectionContract,
  type PullRequestContract,
  type PullRequestPublicationMode,
} from "@otomat/domain";

export interface PrSearch {
  customize?: true;
  mode?: PullRequestPublicationMode;
}

export interface PullRequestConnectionModel {
  connectionLabel: string;
  showConnect: boolean;
  connected: boolean;
  deviceAuthorization: { code: string; url: string } | null;
  errorMessage: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export function isPullRequestPublicationMode(value: string): value is PullRequestPublicationMode {
  return PULL_REQUEST_PUBLICATION_MODES.some((mode) => mode === value);
}

function publishedMode(pullRequest: PullRequestContract): PullRequestPublicationMode | null {
  if (pullRequest.status === "draft") return "draft";
  if (pullRequest.status === "open") return "ready";
  return null;
}

export function initialPublicationMode(
  pullRequest: PullRequestContract | null,
  chosen: PullRequestPublicationMode | undefined,
): PullRequestPublicationMode {
  if (chosen !== undefined) return chosen;
  if (pullRequest === null) return "ready";
  return publishedMode(pullRequest) ?? "ready";
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

interface PullRequestLink {
  label: string | null;
  url: string | null;
}

function link(pullRequest: PullRequestContract | null): PullRequestLink {
  if (pullRequest?.number === null || pullRequest?.number === undefined || !pullRequest.url) {
    return { label: null, url: null };
  }
  return { label: `Open PR #${pullRequest.number}`, url: pullRequest.url };
}

export function pullRequestConnectionModel(
  connection: GitHubConnectionContract,
  pullRequest: PullRequestContract | null,
): PullRequestConnectionModel {
  const providerLink = link(pullRequest);
  const device = connection.device_authorization;
  return {
    connectionLabel: connectionLabel(connection),
    showConnect: connection.status === "disconnected" || connection.status === "failed",
    connected: connection.status === "connected",
    deviceAuthorization: device ? { code: device.user_code, url: device.verification_url } : null,
    errorMessage: pullRequest?.error_message ?? connection.error_message,
    linkLabel: providerLink.label,
    linkUrl: providerLink.url,
  };
}
