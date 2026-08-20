import { COMMIT_SUBJECT_MAX_LENGTH, COMMIT_TYPES } from "@otomat/domain";

import type { GenerationInput } from "./input.js";

const PATCH_BUDGET_CHARS = 40_000;
const ISSUE_BODY_BUDGET_CHARS = 4_000;

export const JSON_OPEN_MARKER = "<otomat-json>";
export const JSON_CLOSE_MARKER = "</otomat-json>";

function truncate(text: string, budget: number): string {
  return text.length > budget ? `${text.slice(0, budget)}\n… (truncated)` : text;
}

function issueSection(input: GenerationInput): string {
  const heading =
    input.issue.sourceIdentifier === null
      ? `Issue: ${input.issue.title}`
      : `Issue ${input.issue.sourceIdentifier}: ${input.issue.title}`;
  const body = input.issue.body?.trim();
  return body ? `${heading}\n${truncate(body, ISSUE_BODY_BUDGET_CHARS)}` : heading;
}

export function generationPrompt(input: GenerationInput): string {
  return [
    "Write the GitHub pull request and the publication commit for the change below.",
    "Otomat composes the subject as `type(scope): summary` and appends the issue reference itself.",
    "",
    issueSection(input),
    "",
    `Changed files:\n${input.diffStat.join("\n")}`,
    "",
    `Patch:\n${truncate(input.patch, PATCH_BUDGET_CHARS)}`,
    "",
    `Answer with ONLY one JSON object between ${JSON_OPEN_MARKER} and ${JSON_CLOSE_MARKER} — no prose, no code fences:`,
    '{"type": "…", "scope": null, "summary": "…", "body": "…", "commit_body": null, "branch": "…", "delivery": "complete"}',
    `- type: one of ${COMMIT_TYPES.join(", ")}`,
    "- scope: the area of the codebase the change touches, lowercase and one word, or null",
    `- summary: imperative, lowercase, no full stop; the composed subject stays within ${String(COMMIT_SUBJECT_MAX_LENGTH)} characters`,
    "- body: GitHub markdown — one-paragraph summary, then bullet points of the key changes, without an issue footer",
    "- commit_body: one extra paragraph for the commit message, or null",
    "- branch: kebab-case git branch such as feat/short-name, at most 50 characters",
    '- delivery: "complete" when the change fully delivers the issue, otherwise "partial"',
  ].join("\n");
}
