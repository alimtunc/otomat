import type { ConversationThreadEntry } from "@otomat/domain";
import { conversationTitle } from "@web/lib/conversations/title";

interface DeskOwnerInput {
  issueId: string | undefined;
  run: string | undefined;
  terminal: string | undefined;
  pullRequestId: string | undefined;
  selectedProjectId: string | undefined;
  sectionLabel: string | undefined;
  issue: { project_id: string; title: string } | undefined;
  pullRequest: { title: string; issue_id: string | null } | undefined;
  entry: ConversationThreadEntry | undefined;
  reviewOwner: string | undefined;
}

interface DeskOwner {
  projectId: string | undefined;
  label: string;
}

export function deskOwner(input: DeskOwnerInput): DeskOwner {
  const { issue, entry } = input;
  if (input.issueId !== undefined)
    return { projectId: issue?.project_id, label: issue?.title ?? "Issue" };
  if (input.terminal !== undefined)
    return {
      projectId: entry?.project.id,
      label: entry === undefined ? "Terminal" : conversationTitle(entry),
    };
  if (input.run !== undefined)
    return {
      projectId: entry?.project.id ?? issue?.project_id,
      label:
        entry === undefined
          ? (issue?.title ?? `Run · ${input.run.slice(0, 8)}`)
          : conversationTitle(entry),
    };
  if (input.pullRequestId !== undefined)
    return {
      projectId:
        (input.pullRequest?.issue_id ?? null) === null
          ? (input.reviewOwner ?? input.selectedProjectId)
          : issue?.project_id,
      label: input.pullRequest?.title ?? "Review",
    };
  return { projectId: input.selectedProjectId, label: input.sectionLabel ?? "Project" };
}
