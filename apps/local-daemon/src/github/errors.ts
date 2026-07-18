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

export function safeGitHubFailure(
  error: unknown,
  fallback = {
    code: "github_publication_failed",
    message: "GitHub publication failed unexpectedly.",
  },
): { code: string; message: string } {
  if (error instanceof GitHubCliError || error instanceof GitHubPublicationError) {
    return { code: error.code, message: error.message };
  }
  return fallback;
}
