import type { IssueContract } from "@otomat/domain";
import { searchIssues } from "@web/lib/issue/search";
import { describe, expect, it } from "vitest";

import { issueContract } from "#support/issue";

function linearIssue(identifier: string, title: string, body: string | null): IssueContract {
  return issueContract({
    id: `id-${identifier}`,
    title,
    body,
    source: "linear",
    source_external_id: `ext-${identifier}`,
    source_identifier: identifier,
    synced_at: "2026-08-12T10:00:00.000Z",
  });
}

function localIssue(id: string, title: string): IssueContract {
  return issueContract({ id, title });
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

  it("matches a term from the description already loaded", () => {
    expect(searchIssues(ALL, "webhook receiver")).toEqual([RETRY]);
  });

  it("ranks an identifier hit above a title hit above a body hit", () => {
    const followUp = linearIssue("OTO-11", "Follow up on OTO-42", null);
    expect(searchIssues([MENTION, followUp, RETRY], "OTO-42")).toEqual([RETRY, followUp, MENTION]);
  });

  it("matches a local issue by the short id the list displays", () => {
    const local = localIssue("7f3ac9d1-0000-4000-8000-000000000000", "Draft the migration");
    expect(searchIssues([local, RETRY], "7F3AC9D1")).toEqual([local]);
  });

  it("returns nothing for a term absent from every loaded field", () => {
    expect(searchIssues(ALL, "kubernetes")).toEqual([]);
  });

  it("leaves the list untouched for a blank query", () => {
    expect(searchIssues(ALL, "   ")).toEqual(ALL);
  });
});
