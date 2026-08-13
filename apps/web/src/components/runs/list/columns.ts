import type { RunContract } from "@otomat/domain";
import { createColumnHelper } from "@tanstack/react-table";
import { RunIdCell } from "@web/components/runs/list/cells/id";
import { RunStatusCell } from "@web/components/runs/list/cells/status";
import { RunUpdatedCell } from "@web/components/runs/list/cells/updated";
import { shortId } from "@web/lib/ids";
import { TABLE_FEATURES } from "@web/lib/table";

const helper = createColumnHelper<typeof TABLE_FEATURES, RunContract>();

export const RUN_COLUMNS = helper.columns([
  helper.accessor((run) => shortId(run.id), {
    id: "run",
    header: "Run",
    meta: { headClassName: "w-27.5", cellClassName: "p-0 font-mono text-text-tertiary" },
    cell: RunIdCell,
  }),
  helper.accessor("status", {
    header: "Status",
    meta: { headClassName: "w-40" },
    cell: RunStatusCell,
  }),
  helper.accessor("branch", {
    header: "Branch",
    meta: { cellClassName: "font-mono text-xs text-text-secondary" },
  }),
  helper.accessor("updated_at", {
    header: "Updated",
    meta: { headClassName: "w-27.5", cellClassName: "text-text-tertiary" },
    cell: RunUpdatedCell,
  }),
]);
