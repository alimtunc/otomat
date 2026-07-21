import type { IssueContract } from "@otomat/domain";

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function issueShortId(issue: Pick<IssueContract, "id" | "source_identifier">): string {
  return issue.source_identifier ?? shortId(issue.id);
}
