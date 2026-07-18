import type { IssueContract } from "@otomat/domain";

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function issueShortId(issue: Pick<IssueContract, "id" | "source_external_id">): string {
  return issue.source_external_id ?? shortId(issue.id);
}
