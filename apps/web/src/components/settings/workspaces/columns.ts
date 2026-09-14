import { createColumnHelper } from "@tanstack/react-table";
import { WorkspaceActionsCell } from "@web/components/settings/workspaces/cells/actions";
import { WorkspaceBranchCell } from "@web/components/settings/workspaces/cells/branch";
import { WorkspaceGitStateCell } from "@web/components/settings/workspaces/cells/git-state";
import { WorkspaceIssueCell } from "@web/components/settings/workspaces/cells/issue";
import { WorkspacePullRequestCell } from "@web/components/settings/workspaces/cells/pull-request";
import { WorkspaceSelectCell } from "@web/components/settings/workspaces/cells/select";
import { WorkspaceSelectHeader } from "@web/components/settings/workspaces/cells/select-header";
import { WorkspaceStateCell } from "@web/components/settings/workspaces/cells/state";
import { WorkspaceUpdatedCell } from "@web/components/settings/workspaces/cells/updated";
import { TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

const helper = createColumnHelper<typeof TABLE_FEATURES, WorkspaceRow>();

export const WORKSPACE_COLUMNS = helper.columns([
  helper.display({
    id: "select",
    header: WorkspaceSelectHeader,
    meta: { headClassName: "w-8", cellClassName: "align-middle" },
    cell: WorkspaceSelectCell,
  }),
  helper.accessor("state", {
    header: "State",
    meta: { headClassName: "w-24 xl:w-32" },
    cell: WorkspaceStateCell,
  }),
  helper.display({ id: "issue", header: "Issue", cell: WorkspaceIssueCell }),
  helper.display({
    id: "branch",
    header: "Branch",
    meta: { headClassName: "w-35 xl:w-47.5" },
    cell: WorkspaceBranchCell,
  }),
  helper.display({
    id: "git",
    header: "Git",
    meta: { headClassName: "w-16 xl:w-20" },
    cell: WorkspaceGitStateCell,
  }),
  helper.display({
    id: "pull_request",
    header: "PR",
    meta: { headClassName: "w-18 xl:w-27.5" },
    cell: WorkspacePullRequestCell,
  }),
  helper.display({
    id: "updated",
    header: "Updated",
    meta: { headClassName: "w-18 xl:w-22.5" },
    cell: WorkspaceUpdatedCell,
  }),
  helper.display({
    id: "actions",
    header: "",
    meta: { headClassName: "w-16 xl:w-20", cellClassName: "text-right" },
    cell: WorkspaceActionsCell,
  }),
]);
