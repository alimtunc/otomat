import { useInbox } from "@web/api/inbox/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { InboxEmpty } from "@web/components/inbox/empty-state";
import { InboxFiltersMenu } from "@web/components/inbox/filters-menu";
import { InboxSectionList } from "@web/components/inbox/section";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import {
  applyInboxEntryFilters,
  inboxEntryFilterOptions,
  NO_INBOX_ENTRY_FILTERS,
} from "@web/lib/inbox/filters";
import { groupInboxEntries } from "@web/lib/inbox/groups";
import { useState } from "react";

export function InboxView() {
  const inbox = useInbox();
  const [filters, setFilters] = useState(NO_INBOX_ENTRY_FILTERS);

  return (
    <RouteShell
      active="inbox"
      titleIcon="inbox"
      titleNote="Everything that needs you, across every project on this host."
      breadcrumbs={[{ label: "Inbox", current: true }]}
      actions={
        <InboxFiltersMenu
          filters={filters}
          options={inboxEntryFilterOptions(inbox.data?.entries ?? [])}
          onChange={setFilters}
        />
      }
    >
      <QueryBoundary
        query={inbox}
        pending={<ListSkeleton rows={3} height={52} />}
        error={
          <ErrorReport
            error={inbox.error}
            context="Couldn’t load the Inbox"
            onRetry={() => void inbox.refetch()}
          />
        }
      >
        {(snapshot) => {
          const entries = applyInboxEntryFilters(snapshot.entries, filters);
          const sections = groupInboxEntries(entries);
          return sections.length === 0 ? (
            <CenteredState>
              <InboxEmpty filtered={snapshot.entries.length > 0} />
            </CenteredState>
          ) : (
            <div className="flex flex-col py-1">
              {sections.map((section) => (
                <InboxSectionList key={section.key} section={section} />
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </RouteShell>
  );
}
