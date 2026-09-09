import { deliveryRefusal, type DeliveryEvidence } from "@otomat/domain";
import { describe, expect, it } from "vitest";

function evidence(overrides: Partial<DeliveryEvidence> = {}): DeliveryEvidence {
  return {
    start_tree_sha: "start",
    start_head_sha: "head",
    end_tree_sha: "end",
    end_head_sha: "head",
    changed_files: 0,
    committed: false,
    observed_commands: 0,
    failed_commands: 0,
    pending_interactions: 0,
    evidence_error: null,
    ...overrides,
  };
}

describe("deliveryRefusal", () => {
  it("blocks every expectation while a question the turn asked is unanswered", () => {
    const asked = evidence({ pending_interactions: 1, changed_files: 3 });
    expect(deliveryRefusal("standard", asked)).toMatch(/unanswered/);
    expect(deliveryRefusal("analysis", asked)).toMatch(/unanswered/);
    expect(deliveryRefusal("implementation", asked)).toMatch(/unanswered/);
  });

  it("lets a clean turn through on the standard and analysis contracts", () => {
    expect(deliveryRefusal("standard", evidence())).toBeNull();
    expect(deliveryRefusal("analysis", evidence())).toBeNull();
  });

  it("blocks an implementation that left the workspace untouched", () => {
    expect(deliveryRefusal("implementation", evidence())).toMatch(/left the workspace unchanged/);
  });

  it("accepts an implementation that changed files, or only committed them", () => {
    expect(deliveryRefusal("implementation", evidence({ changed_files: 2 }))).toBeNull();
    expect(deliveryRefusal("implementation", evidence({ committed: true }))).toBeNull();
  });

  it("blocks an implementation whose observed command failed", () => {
    const failing = evidence({ changed_files: 2, observed_commands: 3, failed_commands: 1 });
    expect(deliveryRefusal("implementation", failing)).toMatch(/1 of the 3 commands/);
  });

  it("refuses to certify an implementation whose workspace could not be read", () => {
    const blind = evidence({ changed_files: 4, evidence_error: "the trees are gone" });
    expect(deliveryRefusal("implementation", blind)).toMatch(/the trees are gone/);
    // An analysis step owes no workspace evidence, so an unreadable one costs it nothing.
    expect(deliveryRefusal("analysis", blind)).toBeNull();
  });
});
