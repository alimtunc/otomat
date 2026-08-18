/** How completely the change delivers its issue; it decides the closing keyword and nothing else. */
export const ISSUE_DELIVERIES = ["complete", "partial"] as const;
export type IssueDelivery = (typeof ISSUE_DELIVERIES)[number];

/** Composed, never asked of the generator: the identifier is a fact Otomat holds. */
export function pullRequestTitle(subject: string, identifier: string | null): string {
  if (identifier === null) return subject;
  const suffix = `(${identifier})`;
  return subject.endsWith(suffix) ? subject : `${subject} ${suffix}`;
}

export function pullRequestBody(
  body: string,
  identifier: string | null,
  delivery: IssueDelivery,
): string {
  const trimmed = body.trimEnd();
  if (identifier === null) return trimmed;
  const footer = `${delivery === "complete" ? "Fixes" : "Refs"} ${identifier}`;
  return trimmed.includes(footer) ? trimmed : `${trimmed}\n\n${footer}`;
}

/** A commit never closes an issue: only the merged pull request may, through its own body. */
export function commitMessage(
  subject: string,
  body: string | null,
  identifier: string | null,
): string {
  const footer = identifier === null ? null : `Refs ${identifier}`;
  const trimmedBody = body?.trim() ?? "";
  const paragraphs = [subject.trim(), trimmedBody === "" ? null : trimmedBody];
  if (footer !== null && !trimmedBody.includes(footer)) paragraphs.push(footer);
  return paragraphs.filter((part) => part !== null).join("\n\n");
}
