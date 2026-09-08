import type { InboxEntry } from "@otomat/domain";
import { InboxEntryRow } from "@web/components/inbox/entry-row";
import { InboxGroup } from "@web/components/inbox/group";
import type { InboxSection } from "@web/lib/inbox/groups";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";

export interface InboxSectionListProps {
  section: InboxSection;
  selected: ReadonlySet<string>;
  pending: boolean;
  onSelectedChange: (entry: InboxEntry, selected: boolean) => void;
  onMark: (entry: InboxEntry, patch: InboxMarkPatch) => void;
}

export function InboxSectionList({
  section,
  selected,
  pending,
  onSelectedChange,
  onMark,
}: InboxSectionListProps) {
  return (
    <InboxGroup label={section.label} count={section.entries.length}>
      {section.entries.map((entry) => (
        <li key={entry.id}>
          <InboxEntryRow
            entry={entry}
            selected={selected.has(entry.id)}
            pending={pending}
            onSelectedChange={(next) => onSelectedChange(entry, next)}
            onMark={(patch) => onMark(entry, patch)}
          />
        </li>
      ))}
    </InboxGroup>
  );
}
