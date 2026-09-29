import type { ConversationThreadEntry } from "@otomat/domain";
import { ConversationGroupItem } from "@web/components/conversations/group-item";
import { ConversationRow } from "@web/components/conversations/row";
import { InboxGroup } from "@web/components/inbox/group";
import type {
  ConversationGroup,
  ConversationSection,
  ConversationSectionKey,
} from "@web/lib/conversations/sections";
import { conversationStatus } from "@web/lib/conversations/status";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import { type KeyboardEvent, type ReactNode, useState } from "react";

export interface ConversationListProps {
  sections: ConversationSection[];
  selectedId: string | null;
  pending: boolean;
  onMark: (entry: ConversationThreadEntry, patch: InboxMarkPatch) => void;
}

function walkRows(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-conversation-row]")];
  const index = rows.findIndex((row) => row === event.target);
  if (index === -1) return;
  rows[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
  event.preventDefault();
}

function sectionKey(section: ConversationSectionKey): string {
  return `section:${section}`;
}

function projectKey(section: ConversationSectionKey, projectId: string): string {
  return `project:${section}:${projectId}`;
}

function groupKey(section: ConversationSectionKey, groupId: string): string {
  return `${section}:${groupId}`;
}

function unreadCount(groups: readonly ConversationGroup[]): number {
  return groups.flatMap((group) => group.entries).filter((entry) => !entry.read).length;
}

function selectionPath(sections: ConversationSection[], selectedId: string | null): string[] {
  for (const { key, projects } of sections)
    for (const { project, groups } of projects)
      for (const group of groups)
        if (group.entries.some((entry) => entry.id === selectedId))
          return [sectionKey(key), projectKey(key, project.id), groupKey(key, group.id)];
  return [];
}

export function ConversationList({ sections, selectedId, pending, onMark }: ConversationListProps) {
  const path = selectionPath(sections, selectedId);
  const selectionKey = path.length === 0 ? null : [...path, selectedId].join(" ");
  const [state, setState] = useState(() => ({
    selectionKey,
    collapsed: new Map<string, boolean>(),
  }));
  if (state.selectionKey !== selectionKey) {
    const collapsed = new Map(state.collapsed);
    for (const key of path) collapsed.delete(key);
    setState({ selectionKey, collapsed });
  }
  const toggle = (key: string, defaultCollapsed: boolean): void => {
    setState((current) => {
      const collapsed = new Map(current.collapsed);
      collapsed.set(key, !(collapsed.get(key) ?? defaultCollapsed));
      return { ...current, collapsed };
    });
  };
  const byProject =
    new Set(sections.flatMap((section) => section.projects.map(({ project }) => project.id))).size >
    1;
  const renderGroup = (section: ConversationSectionKey, group: ConversationGroup): ReactNode => {
    const key = groupKey(section, group.id);
    const defaultCollapsed =
      !path.includes(key) &&
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
      <ConversationGroupItem
        key={group.id}
        group={group}
        nested={byProject}
        collapsed={state.collapsed.get(key) ?? defaultCollapsed}
        onToggle={() => toggle(key, defaultCollapsed)}
      >
        {rows}
      </ConversationGroupItem>
    );
  };
  return (
    <div className="flex flex-col py-1" onKeyDown={walkRows}>
      {sections.map((section) => {
        const key = sectionKey(section.key);
        const defaultCollapsed = section.key === "finished" && !path.includes(key);
        const sectionGroups = section.projects.flatMap((project) => project.groups);
        return (
          <InboxGroup
            key={section.key}
            label={section.label}
            count={sectionGroups.length}
            unreadCount={unreadCount(sectionGroups)}
            collapsed={state.collapsed.get(key) ?? defaultCollapsed}
            onToggle={() => toggle(key, defaultCollapsed)}
          >
            {byProject
              ? section.projects.map(({ project, groups }) => {
                  const toggleKey = projectKey(section.key, project.id);
                  return (
                    <li key={project.id}>
                      <InboxGroup
                        level="h3"
                        label={project.name}
                        count={groups.length}
                        unreadCount={unreadCount(groups)}
                        collapsed={state.collapsed.get(toggleKey) ?? false}
                        onToggle={() => toggle(toggleKey, false)}
                      >
                        {groups.map((group) => renderGroup(section.key, group))}
                      </InboxGroup>
                    </li>
                  );
                })
              : sectionGroups.map((group) => renderGroup(section.key, group))}
          </InboxGroup>
        );
      })}
    </div>
  );
}
