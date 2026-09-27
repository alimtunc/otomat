import type { LinearIssueRelations } from "@otomat/domain";
import { CheckedAt } from "@web/components/shell/checked-at";

import { IssueChildren } from "./children";
import { IssueRelationsList } from "./list";
import { IssueParent } from "./parent";

export function IssueRelationsPanel({
  data,
  identifier,
  refreshing,
  onRefresh,
}: {
  data: LinearIssueRelations;
  identifier: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <IssueParent parent={data.parent} />
      <IssueChildren issues={data.children} />
      <IssueRelationsList relations={data.relations} identifier={identifier} />
      <CheckedAt
        label="Refresh relations"
        checkedAt={data.checked_at}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </div>
  );
}
