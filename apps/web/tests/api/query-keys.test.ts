import { queryKeys } from "@web/api/query-keys";
import { expect, it } from "vitest";

it("keys each diff scope apart so one never serves another's files", () => {
  const target = { kind: "run", id: "run-1" } as const;
  const keys = [
    queryKeys.reviewDiff(target),
    queryKeys.reviewDiff(target, { kind: "step", step: "s1" }),
    queryKeys.reviewDiff(target, { kind: "step", step: "s2" }),
    queryKeys.reviewDiff(target, { kind: "session", session: "s1" }),
    queryKeys.reviewDiff(target, { kind: "commit", commit: "s1" }),
    queryKeys.reviewDiff(target, { kind: "pull_request" }),
  ].map((key) => key.join("/"));

  expect(new Set(keys).size).toBe(keys.length);
});
