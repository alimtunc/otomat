import type { IssueContract } from "@otomat/domain";
import { CLOSED_ISSUE_WORKSPACE } from "@otomat/domain";

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
