import type { Context } from "hono";

import { commandRefusalJson } from "#api/refusal";
import { GitHubCliError, GitHubPublicationError, PullRequestImportRefusal } from "#github";

export function pullRequestImportRefusal(c: Context, error: unknown): Response | null {
  if (!(error instanceof PullRequestImportRefusal)) return null;
  return commandRefusalJson(c, error);
}

/** `merge_unavailable` is a refusal the reviewer reads; every other provider failure keeps gh's own reason under the route's own code. */
export function pullRequestProviderRefusal(
  c: Context,
  error: unknown,
  failed: string,
): Response | null {
  const imported = pullRequestImportRefusal(c, error);
  if (imported !== null) return imported;
  if (error instanceof GitHubPublicationError && error.code === "merge_unavailable") {
    return c.json({ error: "merge_unavailable", message: error.message }, 409);
  }
  if (error instanceof GitHubPublicationError || error instanceof GitHubCliError) {
    return c.json({ error: failed, message: error.message }, 502);
  }
  return null;
}
