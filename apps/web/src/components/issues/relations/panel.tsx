import { IssueChildren } from "./children";
import { IssueParent } from "./parent";
import { IssueRelationsSection } from "./section";

export function IssueLinksPanel({ issueId, identifier }: { issueId: string; identifier: string }) {
  return (
    <div className="space-y-3 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0">
      <IssueParent issueId={issueId} />
      <IssueChildren issueId={issueId} />
      <IssueRelationsSection issueId={issueId} identifier={identifier} />
    </div>
  );
}
