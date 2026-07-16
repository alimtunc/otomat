import type { IssueContract, IssueState } from "@otomat/domain";
import { Button, Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useIssues } from "@web/api/issues/queries";
import { FilterPills } from "@web/components/issues/filter-pills";
import { IssuesList } from "@web/components/issues/issues-list";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { RouteShell } from "@web/components/shell/route-shell";
import { useState } from "react";

type IssuesLayout = "board" | "list";
type IssuesFilter = "all" | "active" | "backlog";

const ACTIVE_STATES = new Set<IssueState>(["ready", "running", "reviewing", "pr_open"]);

function applyFilter(issues: IssueContract[], filter: IssuesFilter): IssueContract[] {
  if (filter === "active") return issues.filter((issue) => ACTIVE_STATES.has(issue.status));
  if (filter === "backlog") return issues.filter((issue) => issue.status === "backlog");
  return issues;
}

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
          <FilterPills
            label="Issue filter"
            value={filter}
            onChange={setFilter}
            pills={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "backlog", label: "Backlog" },
            ]}
          />
          <div className="flex-1" />
          <Button variant="ghost" size="sm" disabled title="Filters are not wired up yet">
            <Icon name="wand-2" aria-hidden />
            Filter
          </Button>
          <NewIssueButton />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <IssuesList
            query={issues}
            filter={(items) => applyFilter(items, filter)}
            board={layout === "board"}
          />
        </div>
      </div>
    </RouteShell>
  );
}
