import type { RunDiffScope } from "@otomat/domain";
import {
  diffScopeDetail,
  diffScopeEmptyDescription,
  diffScopeSummary,
} from "@web/components/runs/diff/scope/label";
import { describe, expect, it } from "vitest";

import { reviewDiff } from "#support/diff-file";
import { BRANCH_SCOPE } from "#support/diff-scope";

const COMMIT: RunDiffScope = {
  kind: "commit",
  commit: "c0ffee0000000000000000000000000000000000",
  short_sha: "c0ffee0",
  subject: "Add the parser",
  parent: "dec0de0000000000000000000000000000000000",
};
const STEP: RunDiffScope = {
  kind: "step",
  step_run_id: "s1",
  step_name: "Implement",
  step_number: 2,
};

describe("naming the scope a diff answered from", () => {
  it("names the branch and the base it is measured against", () => {
    expect(diffScopeSummary(BRANCH_SCOPE)).toBe("Branch · otomat/run/x");
    expect(diffScopeDetail(BRANCH_SCOPE, null)).toContain("otomat/run/x against main");
    expect(diffScopeDetail({ ...BRANCH_SCOPE, base_ref: "release" }, null)).toContain(
      "against release",
    );
  });

  it("states that no branch could be resolved rather than naming a fork point it does not have", () => {
    const unresolved: RunDiffScope = { kind: "branch", branch: null, base_ref: null };
    expect(diffScopeSummary(unresolved)).toBe("Branch");
    expect(diffScopeDetail(unresolved, null)).toContain("No branch could be resolved");
  });

  it("names the two ends the answered patch really spans, so the label is checkable", () => {
    const spanned = diffScopeDetail(
      { kind: "pull_request", number: 224 },
      reviewDiff({ base: "fb15fa1cae86f1bc44a08b987ee03d5d34543add", head: "c8be3d625ee86d5" }),
    );

    expect(spanned).toContain("fb15fa1 → c8be3d6");
  });

  it("names no span for a scope whose ends are trees, and keeps naming the parent commit", () => {
    const detail = diffScopeDetail(
      COMMIT,
      reviewDiff({ base: "treebase0000", head: "treehead000" }),
    );

    expect(detail).toContain("dec0de0");
    expect(detail).not.toContain("Spans");
    expect(diffScopeDetail(BRANCH_SCOPE, reviewDiff())).not.toContain("Spans");
  });

  it("says which scope came back empty, so a step with no delta never reads as a branch with none", () => {
    expect(diffScopeEmptyDescription(STEP)).toContain("Step 2 · Implement");
    expect(diffScopeEmptyDescription(COMMIT)).toContain("Commit c0ffee0");
    expect(diffScopeEmptyDescription(BRANCH_SCOPE)).toContain("no change against main");
    expect(diffScopeEmptyDescription({ kind: "pull_request", number: 79 })).toContain(
      "Pull request #79",
    );
  });
});
