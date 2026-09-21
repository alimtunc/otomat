import type { ConversationEntry } from "@otomat/domain";
import { ConversationRow } from "@web/components/conversations/row";
import { InboxGroup } from "@web/components/inbox/group";
import type { ConversationSection } from "@web/lib/conversations/sections";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import type { KeyboardEvent } from "react";

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
  return (
    <div className="flex flex-col py-1" onKeyDown={walkRows}>
      {sections.map((section) => (
        <InboxGroup key={section.key} label={section.label} count={section.entries.length}>
          {section.entries.map((entry) => (
            <li key={entry.id}>
              <ConversationRow
                entry={entry}
                selected={entry.id === selectedId}
                pending={pending}
                onMark={(patch) => onMark(entry, patch)}
              />
            </li>
          ))}
        </InboxGroup>
      ))}
    </div>
  );
}
