import type { LinearIssueRelation } from "@otomat/domain";
import { Icon, TONE_TEXT } from "@otomat/ui";

import { IssueNeighbor } from "./neighbor";
import { RELATION_GROUPS } from "./relation-labels";

export function IssueRelationsList({
  relations,
  identifier,
}: {
  relations: LinearIssueRelation[];
  identifier: string;
}) {
  if (relations.length === 0) {
    return <p className="text-xs text-text-tertiary">No blocking or related issues.</p>;
  }
  return (
    <div className="@container space-y-3">
      {RELATION_GROUPS.map((group) => {
        const members = relations.filter((relation) => relation.type === group.type);
        return members.length === 0 ? null : (
          <div key={group.type}>
            <h3 className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              {group.tone === null ? null : (
                <Icon name="flag" size="xs" className={TONE_TEXT[group.tone]} />
              )}
              {group.label}
              <span className="font-normal tabular-nums text-text-tertiary">{members.length}</span>
            </h3>
            <div className="mt-2 space-y-2">
              {members.map((relation) => (
                <div key={relation.id} className="rounded-md border border-border bg-surface-1">
                  <IssueNeighbor
                    issue={relation.issue}
                    relation={{ type: relation.type, identifier }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
