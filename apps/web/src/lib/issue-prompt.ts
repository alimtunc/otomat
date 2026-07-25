import type { IssueContract } from "@otomat/domain";

/** The daemon's own fallback is the title alone, so the launch surface sends exactly the text it showed. */
export function issueLaunchPrompt(issue: Pick<IssueContract, "title" | "body">): string {
  const body = issue.body?.trim() ?? "";
  return body ? `${issue.title}\n\n${body}` : issue.title;
}
