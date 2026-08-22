import { InboxEntryRow } from "@web/components/inbox/entry-row";
import { CountBadge } from "@web/components/issues/count-badge";
import type { InboxSection } from "@web/lib/inbox/groups";

export function InboxSectionList({ section }: { section: InboxSection }) {
  return (
    <section className="flex flex-col">
      <h2 className="flex h-8 items-center gap-2 px-2.5 text-sm font-medium text-foreground">
        <span className="truncate">{section.label}</span>
        <CountBadge count={section.entries.length} tone="neutral" />
      </h2>
      <ul className="flex flex-col gap-0.5 px-2 pb-2">
        {section.entries.map((entry) => (
          <li key={entry.id}>
            <InboxEntryRow entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
