import type { ConversationEntry } from "@otomat/domain";
import { ConversationIssueGroupItem } from "@web/components/conversations/issue-group";
import { ConversationRow } from "@web/components/conversations/row";
import { InboxGroup } from "@web/components/inbox/group";
import type { ConversationSection } from "@web/lib/conversations/sections";
import { conversationStatus } from "@web/lib/conversations/status";
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
  const selectedSection = sections.find((section) =>
    section.groups.some((group) => group.entries.some((entry) => entry.id === selectedId)),
  );
  const selectedIssue = selectedSection?.groups.find((group) =>
    group.entries.some((entry) => entry.id === selectedId),
  )?.issue.id;
  const selectionKey =
    selectedSection === undefined ? null : `${selectedSection.key}:${selectedId}`;
  const [state, setState] = useState(() => ({
    selectionKey,
    collapsed: new Map<string, boolean>(),
  }));
  if (state.selectionKey !== selectionKey) {
    const collapsed = new Map(state.collapsed);
    if (selectedSection !== undefined) collapsed.delete(`section:${selectedSection.key}`);
    if (selectedIssue !== undefined) collapsed.delete(`issue:${selectedIssue}`);
    setState({ selectionKey, collapsed });
  }
  const toggle = (key: string, defaultCollapsed: boolean): void => {
    setState((current) => {
      const collapsed = new Map(current.collapsed);
      collapsed.set(key, !(collapsed.get(key) ?? defaultCollapsed));
      return { ...current, collapsed };
    });
  };
  return (
    <div className="flex flex-col py-1" onKeyDown={walkRows}>
      {sections.map((section) => {
        const key = `section:${section.key}`;
        const defaultCollapsed = section.key === "finished" && section !== selectedSection;
        const unreadCount = section.groups.reduce(
          (count, group) => count + group.entries.filter((entry) => !entry.read).length,
          0,
        );
        return (
          <InboxGroup
            key={section.key}
            label={section.label}
            count={section.groups.length}
            unreadCount={unreadCount}
            collapsed={state.collapsed.get(key) ?? defaultCollapsed}
            onToggle={() => toggle(key, defaultCollapsed)}
          >
            {section.groups.map((group) => {
              const groupKey = `issue:${group.issue.id}`;
              const defaultGroupCollapsed =
                group.issue.id !== selectedIssue &&
                !group.entries.some((entry) => conversationStatus([entry]) === "running");
              const single = group.entries.length === 1;
              const rows = group.entries.map((entry) => (
                <li key={entry.id}>
                  <ConversationRow
                    entry={entry}
                    selected={entry.id === selectedId}
                    showIssue={single}
                    pending={pending}
                    onMark={(patch) => onMark(entry, patch)}
                  />
                </li>
              ));
              return single ? (
                rows
              ) : (
                <ConversationIssueGroupItem
                  key={group.issue.id}
                  group={group}
                  collapsed={state.collapsed.get(groupKey) ?? defaultGroupCollapsed}
                  onToggle={() => toggle(groupKey, defaultGroupCollapsed)}
                >
                  {rows}
                </ConversationIssueGroupItem>
              );
            })}
          </InboxGroup>
        );
      })}
    </div>
  );
}
