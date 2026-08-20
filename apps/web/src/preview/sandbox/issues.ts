import { CLOSED_ISSUE_WORKSPACE, type IssueContract } from "@otomat/domain";
import { SANDBOX_NOW, SANDBOX_PROJECT_ID } from "@web/preview/sandbox/workspace";

function localIssue(
  id: string,
  title: string,
  status: IssueContract["status"],
  body: string,
): IssueContract {
  return {
    id,
    project_id: SANDBOX_PROJECT_ID,
    title,
    body,
    status,
    execution: { state: "none", run_id: null },
    workspace: CLOSED_ISSUE_WORKSPACE,
    source: "local",
    source_external_id: null,
    source_identifier: null,
    source_url: null,
    synced_at: null,
    source_assignee_name: null,
    source_priority: null,
    source_labels: null,
    source_state_name: null,
    source_state_color: null,
  };
}

function mirroredIssue(
  id: string,
  identifier: string,
  title: string,
  status: IssueContract["status"],
  stateName: string,
): IssueContract {
  return {
    id,
    project_id: SANDBOX_PROJECT_ID,
    title,
    body: `Mirrored from Linear as ${identifier}.`,
    status,
    execution: { state: "none", run_id: null },
    workspace: CLOSED_ISSUE_WORKSPACE,
    source: "linear",
    source_external_id: `ext-${id}`,
    source_identifier: identifier,
    source_url: `https://linear.app/otomat/issue/${identifier}`,
    synced_at: SANDBOX_NOW,
    source_assignee_name: "Sandbox operator",
    source_priority: 2,
    source_labels: [{ name: "Feature", color: "#5B7CFA" }],
    source_state_name: stateName,
    source_state_color: "#5B7CFA",
  };
}

/** The issue a run is live on: its cycle is open, so the cockpit offers Resume and Add step instead of a fresh launch. */
const RUNNING_ISSUE: IssueContract = {
  ...mirroredIssue("sandbox-issue-2", "OTO-302", "Stream the run ledger", "running", "In Progress"),
  execution: { state: "running", run_id: "sandbox-run-1" },
  workspace: {
    state: "open",
    run_id: "sandbox-run-1",
    branch: "otomat/run/sandbox-1",
    run_status: "running",
    busy: true,
  },
};

const REVIEWING_ISSUE: IssueContract = {
  ...mirroredIssue(
    "sandbox-issue-3",
    "OTO-303",
    "Anchor review comments to a sha",
    "reviewing",
    "In Review",
  ),
  execution: { state: "reviewing", run_id: "sandbox-run-2" },
  workspace: {
    state: "open",
    run_id: "sandbox-run-2",
    branch: "otomat/run/sandbox-2",
    run_status: "completed",
    busy: false,
  },
};

export const SANDBOX_ISSUES: IssueContract[] = [
  mirroredIssue(
    "sandbox-issue-1",
    "OTO-301",
    "Publish web previews per pull request",
    "ready",
    "Todo",
  ),
  RUNNING_ISSUE,
  REVIEWING_ISSUE,
  mirroredIssue(
    "sandbox-issue-4",
    "OTO-304",
    "Reconcile abandoned worktrees",
    "backlog",
    "Backlog",
  ),
  localIssue(
    "sandbox-issue-5",
    "Tidy the settings navigation",
    "ready",
    "A local issue: no tracker mirrors it, so Otomat owns its whole lifecycle.",
  ),
  mirroredIssue("sandbox-issue-6", "OTO-305", "Ship the macOS alpha", "done", "Done"),
];

export function sandboxIssue(id: string): IssueContract | null {
  return SANDBOX_ISSUES.find((issue) => issue.id === id) ?? null;
}
