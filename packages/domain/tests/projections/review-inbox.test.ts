import { expect, it } from "vitest";

import {
  PULL_REQUEST_INBOX_GROUPS,
  type PullRequestInboxEntry,
} from "#domain/contracts/review-inbox";
import {
  classifyPullRequestInboxGroup,
  countActionablePullRequestInboxEntries,
  type PullRequestInboxFacts,
  type PullRequestInboxViewerIdentity,
} from "#domain/projections/review-inbox";

const VIEWER: PullRequestInboxViewerIdentity = { login: "operator", teams: ["acme/core"] };

function facts(overrides: Partial<PullRequestInboxFacts> = {}): PullRequestInboxFacts {
  return {
    status: "open",
    author_login: "operator",
    review_decision: null,
    checks_state: "none",
    mergeable: "mergeable",
    requested_reviewers: [],
    ...overrides,
  };
}

function entry(group: PullRequestInboxEntry["group"]): PullRequestInboxEntry {
  return {
    id: `pr-${group}`,
    group,
    repository: "acme/otomat",
    number: 1,
    title: "Ship it",
    url: null,
    author_login: "operator",
    status: "open",
    provenance: "unknown",
    review_decision: null,
    checks_state: "none",
    mergeable: "mergeable",
    head_ref: "feature",
    base_ref: "main",
    updated_at: "2026-08-18T10:00:00.000Z",
    run_id: null,
    issue: null,
    head_fetched: false,
  };
}

it("groups a pull request that asks the viewer for a review, whoever opened it", () => {
  const requested = facts({
    author_login: "contrib",
    requested_reviewers: [{ kind: "user", handle: "operator" }],
  });
  expect(classifyPullRequestInboxGroup(requested, VIEWER)).toBe("needs_your_review");
});

it("groups a pull request that asks one of the viewer's teams", () => {
  const requested = facts({
    author_login: "contrib",
    requested_reviewers: [{ kind: "team", handle: "acme/core" }],
  });
  expect(classifyPullRequestInboxGroup(requested, VIEWER)).toBe("needs_team_review");
});

it("keeps a team of another organization out, and says nothing when teams are unknown", () => {
  const requested = facts({
    author_login: "contrib",
    requested_reviewers: [{ kind: "team", handle: "other/core" }],
  });
  expect(classifyPullRequestInboxGroup(requested, VIEWER)).toBeNull();
  expect(
    classifyPullRequestInboxGroup(
      { ...requested, requested_reviewers: [{ kind: "team", handle: "acme/core" }] },
      { login: "operator", teams: [] },
    ),
  ).toBeNull();
});

it("prefers a direct request over a team one, so an entry never lands in two groups", () => {
  const both = facts({
    author_login: "contrib",
    requested_reviewers: [
      { kind: "team", handle: "acme/core" },
      { kind: "user", handle: "operator" },
    ],
  });
  expect(classifyPullRequestInboxGroup(both, VIEWER)).toBe("needs_your_review");
});

it("ignores a pull request the viewer has no stake in", () => {
  expect(classifyPullRequestInboxGroup(facts({ author_login: "contrib" }), VIEWER)).toBeNull();
});

it("sorts the viewer's own work by what blocks it", () => {
  expect(classifyPullRequestInboxGroup(facts({ checks_state: "pending" }), VIEWER)).toBe(
    "waiting_for_review",
  );
  expect(classifyPullRequestInboxGroup(facts({ review_decision: "review_required" }), VIEWER)).toBe(
    "waiting_for_review",
  );
  expect(
    classifyPullRequestInboxGroup(
      facts({ review_decision: "approved", checks_state: "passing" }),
      VIEWER,
    ),
  ).toBe("ready_to_merge");
  expect(classifyPullRequestInboxGroup(facts({ status: "draft" }), VIEWER)).toBe("your_drafts");
});

it("calls a blocked pull request actionable before anything else, draft included", () => {
  for (const blocker of [
    { review_decision: "changes_requested" },
    { checks_state: "failing" },
    { mergeable: "conflicting" },
    { status: "draft", checks_state: "failing" },
  ] as const) {
    expect(classifyPullRequestInboxGroup(facts(blocker), VIEWER)).toBe("needs_action");
  }
});

it("shows nothing at all without a signed-in account, and drops a settled pull request", () => {
  expect(classifyPullRequestInboxGroup(facts(), { login: null, teams: [] })).toBeNull();
  for (const status of ["merged", "closed"] as const) {
    expect(classifyPullRequestInboxGroup(facts({ status }), VIEWER)).toBeNull();
  }
});

it("counts each waiting entry once for the badge, and nothing that waits on someone else", () => {
  expect(countActionablePullRequestInboxEntries(PULL_REQUEST_INBOX_GROUPS.map(entry))).toBe(4);
  expect(
    countActionablePullRequestInboxEntries([entry("your_drafts"), entry("waiting_for_review")]),
  ).toBe(0);
});
