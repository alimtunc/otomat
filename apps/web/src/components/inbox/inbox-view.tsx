import type { InboxEntry } from "@otomat/domain";
import { useMarkInbox } from "@web/api/inbox/mutations";
import { useInbox } from "@web/api/inbox/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { InboxBulkActions } from "@web/components/inbox/bulk-actions";
import { InboxEmpty } from "@web/components/inbox/empty-state";
import { InboxFiltersMenu } from "@web/components/inbox/filters-menu";
import { InboxSectionList } from "@web/components/inbox/section";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import {
  activeInboxEntryFilterCount,
  applyInboxEntryFilters,
  inboxEntryFilterOptions,
  NO_INBOX_ENTRY_FILTERS,
  type InboxEntryFilters,
} from "@web/lib/inbox/filters";
import { groupInboxEntries } from "@web/lib/inbox/groups";
import { markInboxRequest, type InboxMarkPatch } from "@web/lib/inbox/marks";
import { useState } from "react";

const NO_SELECTION: ReadonlySet<string> = new Set();

export function InboxView() {
  const inbox = useInbox();
  const mark = useMarkInbox();
  const [filters, setFilters] = useState(NO_INBOX_ENTRY_FILTERS);
  const [selected, setSelected] = useState(NO_SELECTION);

  const visible = applyInboxEntryFilters(inbox.data?.entries ?? [], filters);
  const selectedEntries = visible.filter((entry) => selected.has(entry.id));

  const markEntries = (entries: readonly InboxEntry[], patch: InboxMarkPatch): void => {
    if (entries.length === 0) return;
    mark.mutate(markInboxRequest(entries, patch), { onSuccess: () => setSelected(NO_SELECTION) });
  };

  const filter = (next: InboxEntryFilters): void => {
    setFilters(next);
    setSelected(NO_SELECTION);
  };

  const select = (entry: InboxEntry, next: boolean): void => {
    setSelected((current) => {
      const draft = new Set(current);
      if (next) draft.add(entry.id);
      else draft.delete(entry.id);
      return draft;
    });
  };

  return (
    <RouteShell
      active="inbox"
      titleIcon="inbox"
      titleNote="Everything that needs you, across every project on this host."
      breadcrumbs={[{ label: "Inbox", current: true }]}
      actions={
        <div className="flex items-center gap-2">
          <InboxBulkActions
            visible={visible}
            selected={selectedEntries}
            pending={mark.isPending}
            onMark={markEntries}
            onClearSelection={() => setSelected(NO_SELECTION)}
          />
          <InboxFiltersMenu
            filters={filters}
            options={inboxEntryFilterOptions(inbox.data?.entries ?? [])}
            onChange={filter}
          />
        </div>
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
        {() => {
          const sections = groupInboxEntries(visible);
          return sections.length === 0 ? (
            <CenteredState>
              <InboxEmpty filtered={activeInboxEntryFilterCount(filters) > 0} />
            </CenteredState>
          ) : (
            <div className="flex flex-col py-1">
              {sections.map((section) => (
                <InboxSectionList
                  key={section.key}
                  section={section}
                  selected={selected}
                  pending={mark.isPending}
                  onSelectedChange={select}
                  onMark={(entry, patch) => markEntries([entry], patch)}
                />
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </RouteShell>
  );
}
