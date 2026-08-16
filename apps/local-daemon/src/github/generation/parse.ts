import { z } from "zod";

import { ISSUE_DELIVERIES } from "../conventions/compose.js";
import { COMMIT_SUBJECT_MAX_LENGTH } from "../conventions/conventional-commit.js";
import { GitHubPublicationError } from "../errors.js";
import { JSON_CLOSE_MARKER, JSON_OPEN_MARKER } from "./prompt.js";

export const generationOutputSchema = z.object({
  subject: z.string().trim().min(1).max(COMMIT_SUBJECT_MAX_LENGTH),
  body: z.string().trim().min(1).max(10_000),
  commit_body: z.string().trim().max(4_000).nullish(),
  branch: z.string().trim().min(1).max(80),
  delivery: z.enum(ISSUE_DELIVERIES),
});
export type GenerationOutput = z.infer<typeof generationOutputSchema>;

/** Git-safe kebab slug of the model's proposal; null when nothing usable survives. */
export function sanitizeBranchName(raw: string): string | null {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/(^[-/.]+)|([-/.]+$)/g, "")
    .slice(0, 60)
    .replace(/(^[-/.]+)|([-/.]+$)/g, "");
  if (slug === "" || slug.startsWith("otomat/run")) return null;
  return slug;
}

/** The marked block first; a CLI that reformats its own output still leaves the braces to fall back on. */
function jsonBlock(stdout: string): string {
  const opened = stdout.lastIndexOf(JSON_OPEN_MARKER);
  const closed = stdout.lastIndexOf(JSON_CLOSE_MARKER);
  if (opened !== -1 && closed > opened) {
    return stdout.slice(opened + JSON_OPEN_MARKER.length, closed);
  }
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new GitHubPublicationError("pr_generation_invalid", "The agent returned no JSON answer.");
  }
  return stdout.slice(start, end + 1);
}

export function parseGenerationOutput(stdout: string): GenerationOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock(stdout));
  } catch (error) {
    if (error instanceof GitHubPublicationError) throw error;
    throw new GitHubPublicationError(
      "pr_generation_invalid",
      "The agent's answer was not valid JSON.",
    );
  }
  const result = generationOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new GitHubPublicationError(
      "pr_generation_invalid",
      "The agent's answer was missing a subject, description, branch, or delivery.",
    );
  }
  return result.data;
}
