import type { IssueContract } from "../contracts/entities/issues.js";

export function searchIssues(issues: IssueContract[], query: string): IssueContract[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return issues;
  const ranked: IssueContract[][] = [[], [], []];
  for (const issue of issues) {
    const fields = [issue.source_identifier ?? issue.id.slice(0, 8), issue.title, issue.body ?? ""];
    const rank = fields.findIndex((field) => field.toLowerCase().includes(needle));
    if (rank !== -1) ranked[rank].push(issue);
  }
  return ranked.flat();
}
