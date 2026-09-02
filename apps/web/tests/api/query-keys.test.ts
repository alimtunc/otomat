import { hostKeys } from "@web/api/query-keys";
import { expect, it } from "vitest";

const local = hostKeys("local");

it("keys each diff scope apart so one never serves another's files", () => {
  const target = { kind: "run", id: "run-1" } as const;
  const keys = [
    local.reviewDiff(target),
    local.reviewDiff(target, { kind: "step", step: "s1" }),
    local.reviewDiff(target, { kind: "step", step: "s2" }),
    local.reviewDiff(target, { kind: "session", session: "s1" }),
    local.reviewDiff(target, { kind: "commit", commit: "s1" }),
    local.reviewDiff(target, { kind: "pull_request" }),
  ].map((key) => key.join("/"));

  expect(new Set(keys).size).toBe(keys.length);
});
