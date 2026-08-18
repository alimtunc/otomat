import type { Context } from "hono";

import { PullRequestImportRefusal } from "#github";

export function pullRequestImportRefusal(c: Context, error: unknown): Response | null {
  if (!(error instanceof PullRequestImportRefusal)) return null;
  const status = error.code === "pr_not_found" ? 404 : 409;
  return c.json({ error: error.code, message: error.message }, status);
}
