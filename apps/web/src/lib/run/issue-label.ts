import type { IssueContract } from "@otomat/domain";
import { issueShortId } from "@web/lib/ids";

/** Said out loud rather than falling back to a run id, which answers a different question. */
export const UNLINKED_RUN_LABEL = "Unlinked";

export function runIssueLabel(
  issue: Pick<IssueContract, "id" | "source_identifier" | "title"> | undefined,
): string {
  return issue === undefined ? UNLINKED_RUN_LABEL : `${issueShortId(issue)} · ${issue.title}`;
}
