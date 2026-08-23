import type { IssueContract } from "@otomat/domain";
import { Markdown } from "@otomat/ui";
import { issueShortId } from "@web/lib/ids";

export interface ContextIssuePreviewProps {
  issue: IssueContract;
}

export function ContextIssuePreview({ issue }: ContextIssuePreviewProps) {
  return (
    <>
      <p className="font-semibold">{issue.title}</p>
      <p className="mt-1 text-text-tertiary">
        {issueShortId(issue)} · {issue.source_state_name ?? issue.status}
      </p>
      <div className="mt-2">
        <Markdown value={issue.body ?? "_No description._"} />
      </div>
    </>
  );
}
