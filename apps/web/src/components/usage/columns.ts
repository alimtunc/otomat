import type { UsageRunRow } from "@otomat/domain";
import { createColumnHelper } from "@tanstack/react-table";
import { UsageActivityCell } from "@web/components/usage/cells/activity";
import { UsageCostCell } from "@web/components/usage/cells/cost";
import { UsageDurationCell } from "@web/components/usage/cells/duration";
import { UsageEmittersCell } from "@web/components/usage/cells/emitters";
import { UsageIssueCell } from "@web/components/usage/cells/issue";
import { UsageRunCell } from "@web/components/usage/cells/run";
import { UsageTokensCell } from "@web/components/usage/cells/tokens";
import { TABLE_FEATURES } from "@web/lib/table";

const helper = createColumnHelper<typeof TABLE_FEATURES, UsageRunRow>();

export const USAGE_RUN_COLUMNS = helper.columns([
  helper.accessor("run_id", {
    header: "Run",
    meta: { headClassName: "w-24" },
    cell: UsageRunCell,
  }),
  helper.accessor("issue_title", {
    header: "Issue",
    cell: UsageIssueCell,
  }),
  helper.accessor("project_name", {
    header: "Project",
    meta: { headClassName: "w-36", cellClassName: "text-text-secondary" },
  }),
  helper.display({
    id: "model",
    header: "Model",
    meta: { headClassName: "w-56" },
    cell: UsageEmittersCell,
  }),
  helper.display({
    id: "tokens",
    header: "Tokens",
    meta: { headClassName: "w-44" },
    cell: UsageTokensCell,
  }),
  helper.display({
    id: "cost",
    header: "Cost",
    meta: { headClassName: "w-24" },
    cell: UsageCostCell,
  }),
  helper.accessor("duration_ms", {
    header: "Duration",
    meta: { headClassName: "w-24" },
    cell: UsageDurationCell,
  }),
  helper.accessor("last_activity_at", {
    header: "Last turn",
    meta: { headClassName: "w-24", cellClassName: "text-text-tertiary" },
    cell: UsageActivityCell,
  }),
]);
