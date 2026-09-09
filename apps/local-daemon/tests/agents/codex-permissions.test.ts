import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { insertAgentProfile, updateAgentProfile, writeExecutionDefaults } from "@otomat/db";
import {
  optionSelectionsFromValues,
  overrideLevel,
  resolvedAgentConfigSchema,
  setNextTurnModelRequestSchema,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { resolveAgentConfig, reviseAgentConfigForTurn, validateProfileInput } from "#agents";
import { clearProviderProbeCache } from "#runtime";
import { probeProviderCommand } from "#runtime/probe/command";

import { setupTestDb, type TestDb } from "../support/db.js";
import { STUB_BIN, stubFixture } from "../support/stub-harness.js";

vi.mock("#runtime/probe/command", async (original) => ({
  ...(await original<typeof import("#runtime/probe/command")>()),
  probeProviderCommand: vi.fn(),
}));
vi.mock("#runtime/providers/codex/sandbox", async (original) => ({
  ...(await original<typeof import("#runtime/providers/codex/sandbox")>()),
  probeCodexSandbox: () => ({ status: "available" }),
}));

let fixture: TestDb;
const profile = {
  name: "Reviewed",
  runtime: "codex",
  model: "gpt-5.6-sol",
  options_json: { sandbox: "read-only", approvals_reviewer: "auto_review" },
  guidance: null,
  skill_ids_json: [],
};
beforeEach(() => {
  fixture = setupTestDb("otomat-codex-config-");
  symlinkSync(STUB_BIN, join(fixture.dir, "codex"));
  vi.stubEnv("PATH", fixture.dir);
  clearProviderProbeCache();
  vi.mocked(probeProviderCommand).mockImplementation((_binary, args) => ({
    status: "ok",
    stdout: readFileSync(
      stubFixture(args[0] === "debug" ? "codex-models.json" : "codex-exec-help-0.153.4.txt"),
      "utf8",
    ),
  }));
  insertAgentProfile(fixture.db, { id: "reviewed", ...profile });
});
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.cleanup();
  clearProviderProbeCache();
  vi.resetAllMocks();
});

it("freezes inherited and overridden reviewer permissions with provenance and a serializable identity", () => {
  writeExecutionDefaults(fixture.db, {
    runtime: "codex",
    model: null,
    options: { sandbox: "workspace-write" },
  });
  const config = resolveAgentConfig(fixture.db, { kind: "profile", profileId: "reviewed" });
  expect(config.options).toEqual({
    sandbox: "read-only",
    approvals_reviewer: "auto_review",
    approval_policy: "on-request",
  });
  expect(config.sources?.options).toEqual({
    sandbox: "profile",
    approvals_reviewer: "profile",
    approval_policy: "provider",
  });
  expect(resolvedAgentConfigSchema.parse(JSON.parse(JSON.stringify(config)))).toEqual(config);
  const overrides = {
    sandbox: "workspace-write",
    approval_policy: "never",
    approvals_reviewer: "user",
  };
  const next = resolveAgentConfig(
    fixture.db,
    { kind: "profile", profileId: "reviewed" },
    { levels: [overrideLevel("step", { options: optionSelectionsFromValues(overrides) })] },
  );
  expect(next.options).toEqual(overrides);
  expect(next.sources?.options).toEqual({
    sandbox: "step",
    approval_policy: "step",
    approvals_reviewer: "step",
  });
  expect(next.config_hash).not.toBe(config.config_hash);
});

it("retains unchanged permission provenance when tuning a resumed turn, independently of edited preferences", () => {
  const current = resolveAgentConfig(fixture.db, { kind: "profile", profileId: "reviewed" });
  updateAgentProfile(fixture.db, "reviewed", {
    ...profile,
    options_json: { sandbox: "danger-full-access", approval_policy: "never" },
  });
  const revised = reviseAgentConfigForTurn(current, "gpt-5.6-sol", {
    ...current.options,
    reasoning_effort: "high",
  });
  expect(revised.options).toEqual({ ...current.options, reasoning_effort: "high" });
  expect(revised.sources?.options).toEqual({
    ...current.sources?.options,
    reasoning_effort: "turn",
  });
  expect(revised.sources?.model).toBe(current.sources?.model);
  expect(revised.config_hash).not.toBe(current.config_hash);
});

it("freezes the implied policy and sandbox when selecting automatic review for the next turn", () => {
  const current = resolveAgentConfig(fixture.db, { kind: "profile", profileId: "reviewed" });
  const request = setNextTurnModelRequestSchema.parse({
    agent_session_id: "session",
    current_config_hash: current.config_hash,
    model: null,
    options: { approvals_reviewer: "auto_review" },
  });
  const revised = reviseAgentConfigForTurn(current, request.model, request.options);
  expect(revised.model).toBeNull();
  expect(revised.options).toEqual({
    sandbox: "workspace-write",
    approval_policy: "on-request",
    approvals_reviewer: "auto_review",
  });
  expect(revised.sources?.options.sandbox).toBe("provider");
});

it("refuses incompatible profiles and inherited settings without dropping the reviewer", () => {
  expect(() =>
    validateProfileInput(fixture.db, {
      project_id: null,
      runtime: "codex",
      model: null,
      skill_ids: [],
      options: { approvals_reviewer: "auto_review", approval_policy: "never" },
    }),
  ).toThrow(/requires approval policy on-request/);
  writeExecutionDefaults(fixture.db, {
    runtime: "codex",
    model: null,
    options: { approvals_reviewer: "retired_reviewer" },
  });
  expect(() => resolveAgentConfig(fixture.db, { kind: "runtime", runtimeId: "codex" })).toThrow(
    /retired_reviewer/,
  );
});

it("saves partial permissions and validates them after inheriting the host reviewer", () => {
  const options = { approval_policy: "on-request" };
  writeExecutionDefaults(fixture.db, {
    runtime: "codex",
    model: null,
    options: { approvals_reviewer: "auto_review" },
  });
  expect(() =>
    validateProfileInput(fixture.db, {
      project_id: null,
      runtime: "codex",
      model: null,
      skill_ids: [],
      options,
    }),
  ).not.toThrow();
  updateAgentProfile(fixture.db, "reviewed", { ...profile, options_json: options });
  const config = resolveAgentConfig(fixture.db, { kind: "profile", profileId: "reviewed" });
  expect(config.options).toEqual({
    sandbox: "workspace-write",
    approval_policy: "on-request",
    approvals_reviewer: "auto_review",
  });
  expect(config.sources?.options).toMatchObject({
    approval_policy: "profile",
    approvals_reviewer: "global",
  });
  writeExecutionDefaults(fixture.db, { runtime: "codex", model: null, options: {} });
  expect(() => resolveAgentConfig(fixture.db, { kind: "profile", profileId: "reviewed" })).toThrow(
    /cannot honor requested approval policy/,
  );
});
