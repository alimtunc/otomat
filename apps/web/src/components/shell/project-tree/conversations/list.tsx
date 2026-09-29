import type { ConversationThreadEntry } from "@otomat/domain";
import { FOCUS_RING_INSET } from "@otomat/ui";
import { type ConversationGroup, groupConversationsByOwner } from "@web/lib/conversations/sections";
import { isConversationRunning, isConversationWaiting } from "@web/lib/conversations/status";
import { useState } from "react";

import { SidebarConversationGroup } from "./group";
import { SidebarConversationRow } from "./row";

const VISIBLE_GROUPS = 5;

function conversationTarget(entry: ConversationThreadEntry): string {
  return `/conversations?${new URLSearchParams(
    "terminal" in entry
      ? { terminal: entry.terminal.id }
      : { run: entry.run_id, step: entry.step_run_id },
  )}`;
}

export function SidebarConversations({
  entries,
  href,
  onNavigate,
}: {
  entries: ConversationThreadEntry[];
  href: string | null;
  onNavigate: (target: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlyMap<string, boolean>>(new Map());
  const selected = entries.find((entry) => conversationTarget(entry) === href);
  const groups = groupConversationsByOwner(entries);
  const holdsSelection = (group: ConversationGroup): boolean =>
    selected !== undefined && group.entries.includes(selected);
  const visible = groups.filter((group, index) => index < VISIBLE_GROUPS || holdsSelection(group));
  if (visible.length === 0) return null;
  return (
    <>
      <div className="px-2 pb-1 pt-3 text-micro text-text-tertiary">Conversations</div>
      {visible.map((group) => {
        const isSelected = holdsSelection(group);
        const isCollapsed =
          collapsed.get(group.id) ??
          !(
            isSelected ||
            group.entries.some(
              (entry) => isConversationWaiting(entry) || isConversationRunning(entry),
            )
          );
        return (
          <SidebarConversationGroup
            key={group.id}
            group={group}
            selected={isSelected}
            collapsed={isCollapsed}
            onToggle={() => setCollapsed((current) => new Map(current).set(group.id, !isCollapsed))}
          >
            {group.entries.map((entry) => (
              <SidebarConversationRow
                key={entry.id}
                entry={entry}
                selected={entry === selected}
                onSelect={() => onNavigate(conversationTarget(entry))}
              />
            ))}
          </SidebarConversationGroup>
        );
      })}
      {groups.length > visible.length ? (
        <button
          type="button"
          className={`h-8 w-full rounded px-2 text-left text-xs text-text-tertiary hover:bg-hover ${FOCUS_RING_INSET}`}
          onClick={() => onNavigate("/runs")}
        >
          All project activity
        </button>
      ) : null}
    </>
  );
}
