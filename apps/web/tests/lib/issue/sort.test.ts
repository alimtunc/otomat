import { sortIssues } from "@web/lib/issue/sort";
import { describe, expect, it } from "vitest";

import { issueContract, linearIssueContract } from "#support/issue";

const urgent = linearIssueContract({
  id: "b",
  title: "Bravo",
  status: "ready",
  source_priority: 1,
});
const low = linearIssueContract({ id: "a", title: "Alpha", status: "running", source_priority: 4 });
const none = linearIssueContract({
  id: "c",
  title: "Charlie",
  status: "backlog",
  source_priority: 0,
});

const ALL = [none, urgent, low];

describe("sortIssues", () => {
  it("ranks 'no priority' after Low rather than before Urgent", () => {
    expect(sortIssues(ALL, "priority").map((issue) => issue.id)).toEqual(["b", "a", "c"]);
  });

  it("follows the state machine order for status", () => {
    expect(sortIssues(ALL, "status").map((issue) => issue.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts titles alphabetically", () => {
    expect(sortIssues(ALL, "title").map((issue) => issue.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks every remaining tie on the id, whatever order the daemon returned", () => {
    const first = issueContract({ id: "z", title: "Same", status: "backlog" });
    const second = issueContract({ id: "y", title: "Same", status: "backlog" });
    expect(sortIssues([first, second], "title").map((issue) => issue.id)).toEqual(["y", "z"]);
    expect(sortIssues([second, first], "title").map((issue) => issue.id)).toEqual(["y", "z"]);
  });

  it("leaves the input untouched", () => {
    const input = [...ALL];
    sortIssues(input, "title");
    expect(input).toEqual(ALL);
  });
});
