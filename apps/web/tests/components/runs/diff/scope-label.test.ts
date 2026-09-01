import type { RunDiffScope } from "@otomat/domain";
import {
  diffScopeDetail,
  diffScopeEmptyDescription,
  diffScopeSummary,
} from "@web/components/runs/diff/scope/label";
import { describe, expect, it } from "vitest";

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
    expect(diffScopeDetail(BRANCH_SCOPE)).toContain("otomat/run/x against main");
    expect(diffScopeDetail({ ...BRANCH_SCOPE, base_ref: "release" })).toContain("against release");
  });

  it("states that no branch could be resolved rather than naming a fork point it does not have", () => {
    const unresolved: RunDiffScope = { kind: "branch", branch: null, base_ref: null };
    expect(diffScopeSummary(unresolved)).toBe("Branch");
    expect(diffScopeDetail(unresolved)).toContain("No branch could be resolved");
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
