import { describe, expect, it } from "vitest";

import { CLOSED_ISSUE_WORKSPACE } from "#domain/contracts/entities/issue-workspace";
import type { IssueContract } from "#domain/contracts/entities/issues";
import { searchIssues } from "#domain/projections/search";

function issue(overrides: Partial<IssueContract>): IssueContract {
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

function linearIssue(identifier: string, title: string, body: string | null): IssueContract {
  return issue({
    id: `id-${identifier}`,
    title,
    body,
    source: "linear",
    source_external_id: `ext-${identifier}`,
    source_identifier: identifier,
    synced_at: "2026-08-12T10:00:00.000Z",
  });
}

const RETRY = linearIssue("OTO-42", "Retry queue drain", "The webhook receiver drops retries.");
const SEARCH = linearIssue("OTO-7", "Make issue search reliable", null);
const MENTION = linearIssue("OTO-9", "Rotate tokens", "Blocked on OTO-42 landing first.");

const ALL = [MENTION, SEARCH, RETRY];

describe("searchIssues", () => {
  it("matches an identifier whatever the case typed", () => {
    expect(searchIssues(ALL, "oto-42")).toEqual([RETRY, MENTION]);
  });

  it("matches a term from the title", () => {
    expect(searchIssues(ALL, "QUEUE")).toEqual([RETRY]);
  });

  it("matches a term from the description", () => {
    expect(searchIssues(ALL, "webhook receiver")).toEqual([RETRY]);
  });

  it("ranks an identifier hit above a title hit above a body hit", () => {
    const followUp = linearIssue("OTO-11", "Follow up on OTO-42", null);
    expect(searchIssues([MENTION, followUp, RETRY], "OTO-42")).toEqual([RETRY, followUp, MENTION]);
  });

  it("matches a local issue by the short id the list displays", () => {
    const local = issue({
      id: "7f3ac9d1-0000-4000-8000-000000000000",
      title: "Draft the migration",
    });
    expect(searchIssues([local, RETRY], "7F3AC9D1")).toEqual([local]);
  });

  it("returns nothing for a term absent from every field", () => {
    expect(searchIssues(ALL, "kubernetes")).toEqual([]);
  });

  it("leaves the list untouched for a blank query", () => {
    expect(searchIssues(ALL, "   ")).toEqual(ALL);
  });
});
