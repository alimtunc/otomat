import type { IssueContract, IssueWorkspace, RunState } from "@otomat/domain";
import { CLOSED_ISSUE_WORKSPACE } from "@otomat/domain";

export function openWorkspace(runId: string, runStatus: RunState): IssueWorkspace {
  return {
    state: "open",
    run_id: runId,
    branch: `otomat/run/${runId}`,
    run_status: runStatus,
    busy: false,
  };
}

export function referencedIssue(): IssueContract {
  return issueContract({
    id: "0f8a1c34-9b7e-4f6a-9d21-6c5b1d0e7a42",
    project_id: "p1",
    source: "linear",
    source_identifier: "OTO-42",
    title: "Ship the CSV parser",
  });
}

export function linearIssueContract(overrides: Partial<IssueContract> = {}): IssueContract {
  return issueContract({
    source: "linear",
    source_external_id: "ext-1",
    source_identifier: "OTO-1",
    synced_at: "2026-07-21T10:00:00.000Z",
    ...overrides,
  });
}

export function issueContract(overrides: Partial<IssueContract> = {}): IssueContract {
  return {
    id: "issue-1",
    project_id: "project-1",
    title: "Issue",
    body: null,
    status: "backlog",
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
    ...overrides,
  };
}
