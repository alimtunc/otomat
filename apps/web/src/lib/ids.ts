import type { IssueContract } from "@otomat/domain";

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** The tracker's human key when the issue is mirrored, otherwise a short form of the local id. The external UUID is an identity, never a label. */
export function issueShortId(issue: Pick<IssueContract, "id" | "source_identifier">): string {
  return issue.source_identifier ?? shortId(issue.id);
}
