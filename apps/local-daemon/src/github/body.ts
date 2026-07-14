export function normalizePullRequestBody(body: string | null): string | null {
  return body === "" ? null : body;
}
