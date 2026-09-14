import type { IssueContract } from "../contracts/entities/issues.js";
import { issueShortId } from "./short-id.js";

export function searchIssues(issues: IssueContract[], query: string): IssueContract[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return issues;
  const ranked: IssueContract[][] = [[], [], []];
  for (const issue of issues) {
    const fields = [issueShortId(issue), issue.title, issue.body ?? ""];
    const rank = fields.findIndex((field) => field.toLowerCase().includes(needle));
    if (rank !== -1) ranked[rank].push(issue);
  }
  return ranked.flat();
}
