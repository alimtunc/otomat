import { describe, expect, it } from "vitest";

import {
  providerOptionSetSchema,
  providerOptionsSchema,
  providerOptionValueSchema,
} from "#domain/contracts/provider-options";

describe("providerOptionsSchema", () => {
  it("accepts any value the installed CLI might announce, without a global union", () => {
    const parsed = providerOptionsSchema.parse({
      permission_mode: "dontAsk",
      effort: "xhigh",
      sandbox: "workspace-write",
      approval_policy: "on-request",
      reasoning_effort: "ultra",
    });
    expect(parsed.permission_mode).toBe("dontAsk");
    expect(parsed.reasoning_effort).toBe("ultra");
  });

  it("keeps a value a past CLI accepted, so it can be shown and refused rather than lost", () => {
    expect(providerOptionsSchema.parse({ permission_mode: "default" })).toEqual({
      permission_mode: "default",
    });
  });

  it("refuses a key no adapter wires to a flag", () => {
    expect(providerOptionsSchema.safeParse({ yolo: "true" }).success).toBe(false);
  });

  it("refuses a value that could be read as another CLI argument", () => {
    expect(providerOptionValueSchema.safeParse("--dangerously-skip-permissions").success).toBe(
      false,
    );
    expect(providerOptionValueSchema.safeParse("has space").success).toBe(false);
    expect(providerOptionValueSchema.safeParse("").success).toBe(false);
  });
});

describe("providerOptionSetSchema", () => {
  it("carries the model it was resolved for and a probe verdict beside the options", () => {
    const set = {
      runtime: "codex",
      model: "gpt-5.6-sol",
      detection: { status: "ok", detail: "Announced by `codex exec --help`." },
      options: [
        {
          key: "sandbox",
          description: "What the sandbox lets Codex write.",
          choices: [
            { value: "workspace-write", description: null, dangerous: false },
            { value: "danger-full-access", description: "No sandbox.", dangerous: true },
          ],
          default_value: "workspace-write",
        },
      ],
    };
    expect(providerOptionSetSchema.parse(set)).toEqual(set);
  });

  it("allows a null default, for an option Otomat sends no argument for", () => {
    const set = {
      runtime: "codex",
      model: null,
      detection: { status: "unsupported", detail: "This version documents no such flag." },
      options: [],
    };
    expect(providerOptionSetSchema.parse(set).options).toEqual([]);
  });

  it("refuses a descriptor with no choice at all, which would render an empty picker", () => {
    const set = {
      runtime: "claude",
      model: null,
      detection: { status: "ok", detail: "d" },
      options: [{ key: "effort", description: "d", choices: [], default_value: null }],
    };
    expect(providerOptionSetSchema.safeParse(set).success).toBe(false);
  });
});
