import { describe, expect, it } from "vitest";

import { RUN_PLAN_MAX_STEPS } from "#domain/plan/limits";
import { runPlanInputSchema } from "#domain/plan/validate";

function step(id: string, dependsOn: string[] = []) {
  return {
    id,
    name: `Step ${id}`,
    agent: null,
    note: `Do ${id}`,
    depends_on: dependsOn,
  };
}

function compete(id: string, dependsOn: string[] = []) {
  return {
    id,
    name: `Compete ${id}`,
    depends_on: dependsOn,
    compete: [
      {
        id: `${id}-claude`,
        name: "Claude",
        agent: "claude",
        note: `Solve ${id} with Claude`,
      },
      {
        id: `${id}-codex`,
        name: "Codex",
        agent: "codex",
        note: `Solve ${id} with Codex`,
      },
    ],
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

  it("carries per-node options and refuses a value that could be read as another CLI argument", () => {
    const parsed = runPlanInputSchema.parse({
      version: 1,
      steps: [
        { ...step("plan"), options: { effort: { kind: "agent_default" } } },
        {
          ...step("implement", ["plan"]),
          options: { reasoning_effort: { kind: "value", value: "ultra" } },
        },
        step("verify", ["implement"]),
      ],
    });
    // A step that names no option keeps no key at all, so inheriting reads as absent.
    const options = parsed.steps.map((planStep) =>
      "options" in planStep ? planStep.options : null,
    );
    expect(options).toEqual([
      { effort: { kind: "agent_default" } },
      { reasoning_effort: { kind: "value", value: "ultra" } },
      null,
    ]);
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...step("plan"), options: { effort: { kind: "value", value: "--effort" } } }],
      }).success,
    ).toBe(false);
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

  it("accepts a compete group as one dependency node", () => {
    const parsed = runPlanInputSchema.parse({
      version: 1,
      steps: [
        step("plan"),
        compete("implementation", ["plan"]),
        step("verify", ["implementation"]),
      ],
    });

    expect(parsed.steps).toHaveLength(3);
    expect(parsed.steps[1]).toMatchObject({
      id: "implementation",
      compete: [{ id: "implementation-claude" }, { id: "implementation-codex" }],
    });
  });

  it("requires at least two competitors", () => {
    const group = compete("implementation");
    const messages = issuesOf({
      version: 1,
      steps: [{ ...group, compete: group.compete.slice(0, 1) }],
    });

    expect(messages).toContain("Compete groups require at least two competitors");
  });

  it("rejects dependencies on individual competitors", () => {
    const messages = issuesOf({
      version: 1,
      steps: [compete("implementation"), step("verify", ["implementation-claude"])],
    });

    expect(messages).toContain(
      'Dependencies cannot target competitor "implementation-claude"; depend on group "implementation"',
    );
  });

  it("requires ids to be unique across nodes and competitors", () => {
    const group = compete("implementation");
    const messages = issuesOf({
      version: 1,
      steps: [step("implementation-claude"), group],
    });

    expect(messages).toContain('Duplicate plan id "implementation-claude"');
  });

  it("rejects a node id that collides with an earlier competitor id", () => {
    const messages = issuesOf({
      version: 1,
      steps: [compete("implementation"), step("implementation-claude")],
    });

    expect(messages).toContain('Duplicate plan id "implementation-claude"');
  });

  it("counts competitors against the executable-step limit", () => {
    const group = compete("implementation");
    const oversized = {
      ...group,
      compete: Array.from({ length: RUN_PLAN_MAX_STEPS + 1 }, (_, index) => ({
        id: `candidate-${index}`,
        name: `Candidate ${index}`,
        agent: null,
        note: `Solve with candidate ${index}`,
      })),
    };

    expect(runPlanInputSchema.safeParse({ version: 1, steps: [oversized] }).success).toBe(false);
  });

  it("rejects unknown properties on compete groups and competitors", () => {
    const group = compete("implementation");
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...group, hidden_policy: "pick-first" }],
      }).success,
    ).toBe(false);
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [
          {
            ...group,
            compete: [{ ...group.compete[0], score: 100 }, group.compete[1]],
          },
        ],
      }).success,
    ).toBe(false);
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
    expect(messages).toContain('Duplicate plan id "dup"');
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

  it("rejects a blank note and a blank name", () => {
    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...step("blank"), note: "   " }],
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
