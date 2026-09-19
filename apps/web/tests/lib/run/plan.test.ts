import { blockedDependencyNames } from "@web/lib/run/plan";
import { describe, expect, it } from "vitest";

import { chainRunDetail } from "#support/run";

describe("blockedDependencyNames", () => {
  it("names the canceled dependency a queued step can no longer wait on", () => {
    const blocked = chainRunDetail({ implement: "succeeded", review: "withdrawn" });
    expect(blockedDependencyNames(blocked, "polish")).toEqual(["Step review"]);
    expect(blockedDependencyNames(blocked, "review")).toEqual([]);
  });

  it("stays silent for a step whose dependencies are merely unfinished", () => {
    const waiting = chainRunDetail({ implement: "running" });
    expect(blockedDependencyNames(waiting, "review")).toEqual([]);
    expect(blockedDependencyNames(waiting, "polish")).toEqual([]);
  });
});
