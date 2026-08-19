import type { PullRequestImportErrorCode } from "@otomat/domain";

export class GitHubCliError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GitHubCliError";
  }
}

export class GitHubPublicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GitHubPublicationError";
  }
}

/** An adoption refused because a verification failed; the code names which one, so no ambiguous match is ever applied silently. */
export class PullRequestImportRefusal extends Error {
  constructor(
    readonly code: PullRequestImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PullRequestImportRefusal";
  }
}

export function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PublicationFailure {
  code: string;
  message: string;
}

export function safeGitHubFailure(
  error: unknown,
  fallback = {
    code: "github_publication_failed",
    message: "GitHub publication failed unexpectedly.",
  },
): PublicationFailure {
  if (error instanceof GitHubCliError || error instanceof GitHubPublicationError) {
    return { code: error.code, message: error.message };
  }
  return fallback;
}
