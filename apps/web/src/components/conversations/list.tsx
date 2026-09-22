import type { ConversationEntry } from "@otomat/domain";
import { ConversationIssueGroupItem } from "@web/components/conversations/issue-group";
import { ConversationRow } from "@web/components/conversations/row";
import { InboxGroup } from "@web/components/inbox/group";
import type { ConversationSection } from "@web/lib/conversations/sections";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import { type KeyboardEvent, useState } from "react";

export interface ConversationListProps {
  sections: ConversationSection[];
  selectedId: string | null;
  pending: boolean;
  onMark: (entry: ConversationEntry, patch: InboxMarkPatch) => void;
}

function walkRows(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-conversation-row]")];
  const index = rows.findIndex((row) => row === event.target);
  if (index === -1) return;
  rows[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
  event.preventDefault();
}

export function ConversationList({ sections, selectedId, pending, onMark }: ConversationListProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (issueId: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(issueId)) next.add(issueId);
      return next;
    });
  };
  return (
    <div className="flex flex-col py-1" onKeyDown={walkRows}>
      {sections.map((section) => (
        <InboxGroup key={section.key} label={section.label} count={section.groups.length}>
          {section.groups.map((group) => (
            <ConversationIssueGroupItem
              key={group.issue.id}
              group={group}
              collapsed={collapsed.has(group.issue.id)}
              onToggle={() => toggle(group.issue.id)}
            >
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <ConversationRow
                    entry={entry}
                    selected={entry.id === selectedId}
                    pending={pending}
                    onMark={(patch) => onMark(entry, patch)}
                  />
                </li>
              ))}
            </ConversationIssueGroupItem>
          ))}
        </InboxGroup>
      ))}
    </div>
  );
}
