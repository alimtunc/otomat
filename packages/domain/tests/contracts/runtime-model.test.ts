import { describe, expect, it } from "vitest";

import { resolvedAgentConfigSchema } from "#domain/contracts/entities/agents";
import { startRunRequestSchema } from "#domain/contracts/run";
import {
  MODEL_ID_MAX_LENGTH,
  modelIdSchema,
  modelSelectionSchema,
} from "#domain/contracts/runtime-model";
import { runPlanInputSchema } from "#domain/plan/validate";

describe("model identifiers", () => {
  it("accepts the shapes providers actually use", () => {
    for (const id of ["opus", "gpt-5.6-sol", "claude-fable-5", "org/model:v2"]) {
      expect(modelIdSchema.parse(id)).toBe(id);
    }
  });

  it("rejects anything a CLI could read as another flag or as no value at all", () => {
    for (const id of ["--model", "-m", " ", "", "opus --dangerously-skip-permissions"]) {
      expect(modelIdSchema.safeParse(id).success).toBe(false);
    }
    expect(modelIdSchema.safeParse("x".repeat(MODEL_ID_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe("model selection", () => {
  it("distinguishes the provider default from an explicit model", () => {
    expect(modelSelectionSchema.parse({ kind: "provider_default" })).toEqual({
      kind: "provider_default",
    });
    expect(modelSelectionSchema.parse({ kind: "model", id: "opus" })).toEqual({
      kind: "model",
      id: "opus",
    });
  });

  it("rejects a default carrying an id, and an unknown kind", () => {
    expect(modelSelectionSchema.safeParse({ kind: "provider_default", id: "opus" }).success).toBe(
      false,
    );
    expect(modelSelectionSchema.safeParse({ kind: "inherit" }).success).toBe(false);
  });
});

describe("frozen agent config", () => {
  const base = {
    runtime: "fake",
    profile_id: null,
    profile_name: null,
    options: {},
    guidance: null,
    skills: [],
    config_hash: "h",
  };

  it("reads a plan frozen before model selection or provenance existed as unknown", () => {
    const parsed = resolvedAgentConfigSchema.parse(base);
    expect(parsed.model).toBeNull();
    expect(parsed.sources).toBeNull();
  });

  it("keeps the level each frozen value came from", () => {
    const parsed = resolvedAgentConfigSchema.parse({
      ...base,
      options: { effort: "high" },
      sources: { runtime: "launch", model: "global", options: { effort: "step" } },
    });
    expect(parsed.sources).toEqual({
      runtime: "launch",
      model: "global",
      options: { effort: "step" },
    });
  });

  it("keeps the resolved model with the provenance it froze under", () => {
    const parsed = resolvedAgentConfigSchema.parse({
      ...base,
      model: { id: "gpt-5.6-sol", source: "discovered" },
    });
    expect(parsed.model).toEqual({ id: "gpt-5.6-sol", source: "discovered" });
  });

  it("refuses a provenance that is not one of the three honest sources", () => {
    expect(
      resolvedAgentConfigSchema.safeParse({ ...base, model: { id: "opus", source: "available" } })
        .success,
    ).toBe(false);
  });
});

describe("launch requests", () => {
  it("carries a per-launch model override", () => {
    const parsed = startRunRequestSchema.parse({
      prompt: "do it",
      runtime: "fake",
      model: { kind: "model", id: "fake-fast" },
    });
    expect(parsed.model).toEqual({ kind: "model", id: "fake-fast" });
  });

  it("carries an independent model on a plan step and rejects an unusable one", () => {
    const step = {
      id: "a",
      name: "Step",
      agent: null,
      note: "go",
      depends_on: [],
    };
    const plan = runPlanInputSchema.parse({
      version: 1,
      steps: [{ ...step, model: { kind: "model", id: "fake-fast" } }],
    });
    expect(plan.steps[0]).toMatchObject({ model: { kind: "model", id: "fake-fast" } });

    expect(
      runPlanInputSchema.safeParse({
        version: 1,
        steps: [{ ...step, model: { kind: "model", id: "--sneaky" } }],
      }).success,
    ).toBe(false);
  });
});
