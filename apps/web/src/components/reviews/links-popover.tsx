import type { PullRequestInboxEntry } from "@otomat/domain";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@otomat/ui";
import { PullRequestStackSection } from "@web/components/pull-requests/stack-section";
import { ReviewLinkedIssue } from "@web/components/reviews/linked-issue";
import type { ReactElement } from "react";

export function ReviewLinksPopover({
  entry,
  children,
}: {
  entry: PullRequestInboxEntry;
  children: ReactElement;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger delay={350} render={children} />
      <PreviewCardContent
        role="dialog"
        align="end"
        aria-label={`Linked work for PR #${entry.number}`}
        className="max-h-[min(40rem,80dvh)] w-96 max-w-[calc(100vw-1rem)] space-y-3 overflow-y-auto p-3"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-xs">
          <span className="font-medium text-foreground">Linked work</span>
          <span className="font-mono text-text-tertiary">#{entry.number}</span>
        </div>
        {entry.issue === null ? (
          <p className="text-xs text-text-tertiary">No linked issue.</p>
        ) : (
          <ReviewLinkedIssue issue={entry.issue} />
        )}
        <PullRequestStackSection pullRequestId={entry.id} />
      </PreviewCardContent>
    </PreviewCard>
  );
}
