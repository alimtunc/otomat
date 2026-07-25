import type { IssueContract } from "@otomat/domain";

/**
 * What a run launched from an issue starts with. The daemon falls back to the
 * title alone, so the launch surface prefills the description too and sends the
 * text it showed: what the agent receives is never wider than what was on screen.
 */
export function issueLaunchPrompt(issue: Pick<IssueContract, "title" | "body">): string {
  const body = issue.body?.trim() ?? "";
  return body ? `${issue.title}\n\n${body}` : issue.title;
}
