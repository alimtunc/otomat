import { issueShortId, type IssueContract } from "@otomat/domain";
import { Markdown } from "@otomat/ui";
import { LinearMediaProvider } from "@web/components/issues/workspace/linear/media";

export interface ContextIssuePreviewProps {
  issue: IssueContract;
}

export function ContextIssuePreview({ issue }: ContextIssuePreviewProps) {
  const body = <Markdown value={issue.body ?? "_No description._"} allowMedia />;
  return (
    <>
      <p className="font-semibold">{issue.title}</p>
      <p className="mt-1 text-text-tertiary">
        {issueShortId(issue)} · {issue.source_state_name ?? issue.status}
      </p>
      <div className="mt-2">
        {issue.source === "linear" ? (
          <LinearMediaProvider issueId={issue.id}>{body}</LinearMediaProvider>
        ) : (
          body
        )}
      </div>
    </>
  );
}
