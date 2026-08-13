import type { IssueContract } from "@otomat/domain";
import { issueShortId } from "@web/lib/ids";

/** Field order doubles as ranking: an identifier hit outranks a title hit, which outranks a body hit. */
const FIELDS: Array<(issue: IssueContract) => string> = [
  issueShortId,
  (issue) => issue.title,
  (issue) => issue.body ?? "",
];

export function searchIssues(issues: IssueContract[], query: string): IssueContract[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return issues;
  const ranked: IssueContract[][] = FIELDS.map(() => []);
  for (const issue of issues) {
    const rank = FIELDS.findIndex((read) => read(issue).toLowerCase().includes(needle));
    if (rank !== -1) ranked[rank].push(issue);
  }
  return ranked.flat();
}
