import { issueShortId, type IssueSummary } from "@otomat/domain";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@otomat/ui";
import type { ReactElement } from "react";

import { IssueRelationsDisclosure } from "../relations/disclosure";
import { IssuePreviewOverview } from "./overview";

export function IssuePreviewCard({
  issue,
  children,
}: {
  issue: IssueSummary | null;
  children: ReactElement;
}) {
  const identifier = issue === null ? "" : issueShortId(issue);
  return (
    <PreviewCard>
      <PreviewCardTrigger delay={350} render={children} />
      {issue !== null ? (
        <PreviewCardContent
          role="dialog"
          aria-label={`Issue preview for ${identifier}`}
          className="max-h-[min(36rem,80dvh)] w-96 max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
        >
          <IssuePreviewOverview issue={issue} />
          {issue.source === "linear" ? (
            <div className="mt-3 border-t border-border-subtle pt-3">
              <IssueRelationsDisclosure issueId={issue.id} identifier={identifier} />
            </div>
          ) : null}
        </PreviewCardContent>
      ) : null}
    </PreviewCard>
  );
}
