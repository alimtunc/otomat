import { projectOpenCycleExecution, type IssueSummary } from "@otomat/domain";
import { createColumnHelper } from "@tanstack/react-table";
import { IssueAssigneeCell } from "@web/components/issues/list/cells/assignee";
import { IssueExecutionCell } from "@web/components/issues/list/cells/execution";
import { IssueSourceCell } from "@web/components/issues/list/cells/source";
import { IssueStatusCell } from "@web/components/issues/list/cells/status";
import { IssueTitleCell } from "@web/components/issues/list/cells/title";
import { IssueUpdatedCell } from "@web/components/issues/list/cells/updated";
import { issueShortId } from "@web/lib/ids";
import { TABLE_FEATURES } from "@web/lib/table";

const helper = createColumnHelper<typeof TABLE_FEATURES, IssueSummary>();

export const ISSUE_COLUMNS = helper.columns([
  helper.accessor(issueShortId, {
    id: "id",
    header: "ID",
    meta: {
      headClassName: "w-22.5",
      cellClassName: "whitespace-nowrap font-mono text-text-tertiary",
    },
  }),
  helper.accessor("title", {
    header: "Title",
    meta: { cellClassName: "p-0" },
    cell: IssueTitleCell,
  }),
  helper.accessor("status", {
    id: "status",
    header: "Status",
    meta: { headClassName: "w-27.5" },
    cell: IssueStatusCell,
  }),
  helper.accessor(projectOpenCycleExecution, {
    id: "execution",
    header: "Execution",
    meta: { headClassName: "w-27.5" },
    cell: IssueExecutionCell,
  }),
  helper.accessor("source", {
    id: "source",
    header: "Source",
    meta: { headClassName: "w-22.5", cellClassName: "text-text-secondary" },
    cell: IssueSourceCell,
  }),
  helper.accessor("source_assignee_name", {
    id: "assignee",
    header: "Assignee",
    meta: { headClassName: "w-35" },
    cell: IssueAssigneeCell,
  }),
  helper.accessor("synced_at", {
    header: "Updated",
    meta: { headClassName: "w-27.5", cellClassName: "text-text-tertiary" },
    cell: IssueUpdatedCell,
  }),
]);
