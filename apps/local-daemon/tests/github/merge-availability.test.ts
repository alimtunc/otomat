import { expect, it } from "vitest";

import { mergeAvailability, type RepositoryMergePolicy } from "#github";

import { pullRequestRow } from "../support/github.js";

const BOTH_METHODS: RepositoryMergePolicy = { methods: ["merge", "squash"], canPush: true };

const OPEN = {
  origin: "imported",
  provenance: "otomat",
  number: 7,
  status: "open",
  head_ref: "contrib/fix",
  base_ref: "main",
  checks_state: "passing",
  mergeable: "mergeable",
} as const;

function availability(
  overrides: Parameters<typeof pullRequestRow>[0] = {},
  policy: RepositoryMergePolicy = BOTH_METHODS,
  mergeState = "CLEAN",
  viewerLogin: string | null = "octocat",
) {
  return mergeAvailability({
    row: pullRequestRow({ ...OPEN, ...overrides }),
    mergeState,
    policy,
    viewerLogin,
  });
}

it("offers both methods on a pull request the workspace owns", () => {
  expect(availability()).toEqual({
    methods: ["merge", "squash"],
    blocker: null,
    reason: "Pull request #7 can be merged into main.",
  });
});

it("offers nothing on someone else's branch, and says whose it is", () => {
  const refused = availability({ provenance: "external", author_login: "contrib" });
  expect(refused.methods).toEqual([]);
  expect(refused.blocker).toBe("not_authorized");
  expect(refused.reason).toContain("contrib/fix");
});

it("offers the merge when the authenticated identity opened the pull request itself", () => {
  const allowed = availability({ provenance: "unknown", author_login: "octocat" });
  expect(allowed.blocker).toBeNull();
  expect(allowed.methods).toEqual(["merge", "squash"]);
});

it("refuses when GitHub grants no push permission", () => {
  const refused = availability({}, { methods: ["squash"], canPush: false });
  expect(refused.blocker).toBe("no_permission");
  expect(refused.methods).toEqual([]);
});

it("offers only the methods the repository allows", () => {
  expect(availability({}, { methods: ["squash"], canPush: true }).methods).toEqual(["squash"]);
  const none = availability({}, { methods: [], canPush: true });
  expect(none.blocker).toBe("no_method");
});

it("refuses a pull request that is not open", () => {
  expect(availability({ status: "draft" }).blocker).toBe("not_open");
  expect(availability({ status: "merged" }).reason).toContain("merged");
});

it("names a conflict rather than letting GitHub refuse the merge", () => {
  const refused = availability({ mergeable: "conflicting" }, BOTH_METHODS, "DIRTY");
  expect(refused.blocker).toBe("conflicting");
  expect(refused.reason).toContain("main");
});

it("names running checks before any other merge-state verdict", () => {
  const refused = availability({ checks_state: "pending" }, BOTH_METHODS, "BLOCKED");
  expect(refused.blocker).toBe("checks_pending");
});

it("names a stale base and a blocked merge separately", () => {
  expect(availability({}, BOTH_METHODS, "BEHIND").blocker).toBe("behind_base");
  expect(availability({}, BOTH_METHODS, "BLOCKED").blocker).toBe("blocked");
  expect(availability({}, BOTH_METHODS, "UNKNOWN").blocker).toBe("unknown");
});
