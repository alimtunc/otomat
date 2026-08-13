export function normalizePullRequestBody(body: string | null): string | null {
  return body === "" ? null : body;
}

/** GitHub reads a fenced `suggestion` block as a change applicable to the commented lines. */
export function reviewCommentBody(body: string, suggestion: string | null): string {
  if (suggestion === null) return body;
  const block = ["```suggestion", suggestion, "```"].join("\n");
  return body.trim() === "" ? block : `${body}\n\n${block}`;
}
