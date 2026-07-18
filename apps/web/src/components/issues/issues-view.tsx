import { Button, Icon, Pill, PillTabs, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useIssues } from "@web/api/issues/queries";
import { IssuesContent } from "@web/components/issues/issues-content";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { RouteShell } from "@web/components/shell/route-shell";
import { applyIssuesFilter, isIssuesFilter, type IssuesFilter } from "@web/lib/issue-filters";
import { useState } from "react";

type IssuesLayout = "board" | "list";

export function IssuesView() {
  const issues = useIssues();
  const [layout, setLayout] = useState<IssuesLayout>("board");
  const [filter, setFilter] = useState<IssuesFilter>("all");

  return (
    <RouteShell
      active="issues"
      titleIcon="list-todo"
      breadcrumbs={[{ label: "Issues", current: true }]}
      actions={
        <SegmentedControl
          type="single"
          value={layout}
          onValueChange={(value) => {
            if (value === "board" || value === "list") setLayout(value);
          }}
          aria-label="Issues layout"
        >
          <SegmentedItem value="board" icon={<Icon name="columns-3" />}>
            Board
          </SegmentedItem>
          <SegmentedItem value="list" icon={<Icon name="list" />}>
            List
          </SegmentedItem>
        </SegmentedControl>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10.5 flex-none items-center gap-2 border-b border-border-subtle px-4.5">
          <PillTabs
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (isIssuesFilter(value)) setFilter(value);
            }}
            aria-label="Issue filter"
          >
            <Pill value="all">All</Pill>
            <Pill value="active">Active</Pill>
            <Pill value="backlog">Backlog</Pill>
          </PillTabs>
          <div className="flex-1" />
          <span title="Filters are not wired up yet">
            <Button variant="ghost" size="sm" disabled>
              <Icon name="wand-2" aria-hidden />
              Filter
            </Button>
          </span>
          <NewIssueButton />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <IssuesContent
            query={issues}
            filter={(items) => applyIssuesFilter(items, filter)}
            board={layout === "board"}
          />
        </div>
      </div>
    </RouteShell>
  );
}
