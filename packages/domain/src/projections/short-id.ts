import type { IssueContract } from "../contracts/entities/issues.js";

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function issueShortId(issue: Pick<IssueContract, "id" | "source_identifier">): string {
  return issue.source_identifier ?? shortId(issue.id);
}
