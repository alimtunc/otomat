import type { GenerationInput } from "./input.js";

const PATCH_BUDGET_CHARS = 40_000;
const ISSUE_BODY_BUDGET_CHARS = 4_000;
const EVIDENCE_LINES = 12;

export const JSON_OPEN_MARKER = "<otomat-json>";
export const JSON_CLOSE_MARKER = "</otomat-json>";

function truncate(text: string, budget: number): string {
  return text.length > budget ? `${text.slice(0, budget)}\n… (truncated)` : text;
}

function issueSection(input: GenerationInput): string {
  const heading =
    input.issue.identifier === null
      ? `Issue: ${input.issue.title}`
      : `Issue ${input.issue.identifier}: ${input.issue.title}`;
  const body = input.issue.body?.trim();
  return body ? `${heading}\n${truncate(body, ISSUE_BODY_BUDGET_CHARS)}` : heading;
}

function conventionSection(input: GenerationInput): string {
  const evidence = input.conventionEvidence
    .slice(0, EVIDENCE_LINES)
    .map((subject) => `- ${subject}`)
    .join("\n");
  if (input.convention === "conventional") {
    return [
      "This repository writes Conventional Commits — `type(scope): summary`.",
      "Reuse the types and scopes its recent subjects already use:",
      evidence,
    ].join("\n");
  }
  return [
    "This repository shows no subject convention; write a plain imperative summary.",
    evidence === "" ? "Its history carries no subject to follow." : `Recent subjects:\n${evidence}`,
  ].join("\n");
}

export function generationPrompt(input: GenerationInput): string {
  return [
    "Write the GitHub pull request and the publication commit for the change below.",
    "",
    issueSection(input),
    "",
    conventionSection(input),
    "",
    `Changed files:\n${input.diffStat.join("\n")}`,
    "",
    `Patch:\n${truncate(input.patch, PATCH_BUDGET_CHARS)}`,
    "",
    `Answer with ONLY one JSON object between ${JSON_OPEN_MARKER} and ${JSON_CLOSE_MARKER} — no prose, no code fences:`,
    '{"subject": "…", "body": "…", "commit_body": null, "branch": "…", "delivery": "complete"}',
    "- subject: the commit subject, at most 72 characters, without the issue identifier",
    "- body: GitHub markdown — one-paragraph summary, then bullet points of the key changes, without an issue footer",
    "- commit_body: one extra paragraph for the commit message, or null",
    "- branch: kebab-case git branch such as feat/short-name, at most 50 characters",
    '- delivery: "complete" when the change fully delivers the issue, otherwise "partial"',
  ].join("\n");
}
