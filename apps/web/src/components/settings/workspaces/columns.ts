import { createColumnHelper } from "@tanstack/react-table";
import { WorkspaceActionsCell } from "@web/components/settings/workspaces/cells/actions";
import { WorkspaceBranchCell } from "@web/components/settings/workspaces/cells/branch";
import { WorkspaceGitStateCell } from "@web/components/settings/workspaces/cells/git-state";
import { WorkspaceIssueCell } from "@web/components/settings/workspaces/cells/issue";
import { WorkspacePathCell } from "@web/components/settings/workspaces/cells/path";
import { WorkspacePullRequestCell } from "@web/components/settings/workspaces/cells/pull-request";
import { WorkspaceStateCell } from "@web/components/settings/workspaces/cells/state";
import { WorkspaceUpdatedCell } from "@web/components/settings/workspaces/cells/updated";
import { TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

const helper = createColumnHelper<typeof TABLE_FEATURES, WorkspaceRow>();

export const WORKSPACE_COLUMNS = helper.columns([
  helper.accessor("state", {
    header: "State",
    meta: { headClassName: "w-32" },
    cell: WorkspaceStateCell,
  }),
  helper.display({ id: "issue", header: "Issue", cell: WorkspaceIssueCell }),
  helper.display({
    id: "branch",
    header: "Branch",
    meta: { headClassName: "w-44" },
    cell: WorkspaceBranchCell,
  }),
  helper.display({
    id: "git",
    header: "Git",
    meta: { headClassName: "w-22" },
    cell: WorkspaceGitStateCell,
  }),
  helper.display({
    id: "pull_request",
    header: "PR",
    meta: { headClassName: "w-24" },
    cell: WorkspacePullRequestCell,
  }),
  helper.display({
    id: "updated",
    header: "Updated",
    meta: { headClassName: "w-22" },
    cell: WorkspaceUpdatedCell,
  }),
  helper.display({
    id: "path",
    header: "Path",
    meta: { headClassName: "w-1/6" },
    cell: WorkspacePathCell,
  }),
  helper.display({
    id: "actions",
    header: "",
    meta: { headClassName: "w-12", cellClassName: "text-right" },
    cell: WorkspaceActionsCell,
  }),
]);
