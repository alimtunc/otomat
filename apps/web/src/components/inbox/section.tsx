import { InboxEntryRow } from "@web/components/inbox/entry-row";
import { InboxGroup } from "@web/components/inbox/group";
import type { InboxSection } from "@web/lib/inbox/groups";

export function InboxSectionList({ section }: { section: InboxSection }) {
  return (
    <InboxGroup label={section.label} count={section.entries.length}>
      {section.entries.map((entry) => (
        <li key={entry.id}>
          <InboxEntryRow entry={entry} />
        </li>
      ))}
    </InboxGroup>
  );
}
