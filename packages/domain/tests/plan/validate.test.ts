import { describe, expect, it } from "vitest";

import { RUN_PLAN_MAX_STEPS } from "#domain/plan/limits";
import { runPlanInputSchema } from "#domain/plan/validate";

function step(id: string, dependsOn: string[] = []) {
  return {
    id,
    name: `Step ${id}`,
    agent: null,
    prompt: `Do ${id}`,
    depends_on: dependsOn,
  };
}

function issuesOf(plan: unknown): string[] {
  const result = runPlanInputSchema.safeParse(plan);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

describe("runPlanInputSchema", () => {
  it("accepts a linear three-step plan", () => {
    const parsed = runPlanInputSchema.parse({
      version: 1,
      steps: [step("plan"), step("implement", ["plan"]), step("verify", ["implement"])],
    });
    expect(parsed.steps.map((planStep) => planStep.id)).toEqual(["plan", "implement", "verify"]);
  });

  it("accepts a diamond dependency graph", () => {
    const result = runPlanInputSchema.safeParse({
      version: 1,
      steps: [
        step("root"),
        step("left", ["root"]),
        step("right", ["root"]),
        step("merge", ["left", "right"]),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty plan", () => {
    expect(runPlanInputSchema.safeParse({ version: 1, steps: [] }).success).toBe(false);
  });

  it("rejects more steps than the limit", () => {
    const steps = Array.from({ length: RUN_PLAN_MAX_STEPS + 1 }, (_, index) =>
      step(`step-${index}`),
    );
    expect(runPlanInputSchema.safeParse({ version: 1, steps }).success).toBe(false);
  });

  it("rejects duplicate step ids", () => {
    const messages = issuesOf({ version: 1, steps: [step("dup"), step("dup")] });
    expect(messages).toContain('Duplicate step id "dup"');
  });

  it("rejects unknown dependencies", () => {
    const messages = issuesOf({ version: 1, steps: [step("solo", ["ghost"])] });
    expect(messages).toContain('Unknown dependency "ghost"');
  });

  it("rejects self-dependencies", () => {
    const messages = issuesOf({ version: 1, steps: [step("loop", ["loop"])] });
    expect(messages).toContain('Step "loop" cannot depend on itself');
  });

  it("rejects duplicate dependency entries", () => {
    const messages = issuesOf({
      version: 1,
      steps: [step("base"), step("top", ["base", "base"])],
    });
    expect(messages).toContain('Duplicate dependency "base"');
  });

  it("rejects a two-step cycle", () => {
    const messages = issuesOf({
      version: 1,
      steps: [step("a", ["b"]), step("b", ["a"])],
    });
    expect(messages.some((message) => message.startsWith("Dependency cycle"))).toBe(true);
  });

  it("does not report a false cycle when a dependency is unknown", () => {
    const messages = issuesOf({ version: 1, steps: [step("solo", ["ghost"])] });
    expect(messages.some((message) => message.startsWith("Dependency cycle"))).toBe(false);
  });

  it("rejects malformed step ids", () => {
    expect(runPlanInputSchema.safeParse({ version: 1, steps: [step("Bad Id")] }).success).toBe(
      false,
    );
  });

  it("rejects blank prompts and names", () => {
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...step("blank"), prompt: "   " }],
      }).success,
    ).toBe(false);
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...step("blank"), name: "" }],
      }).success,
    ).toBe(false);
  });

  it("rejects plan versions other than 1", () => {
    expect(runPlanInputSchema.safeParse({ version: 2, steps: [step("a")] }).success).toBe(false);
  });
});
