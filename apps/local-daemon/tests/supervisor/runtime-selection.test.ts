import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getAgent, getRun, schema } from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureRuntimeAgent, runtimeForRun } from "#supervisor/runtime-selection";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";

let harness: DaemonTestDb;

beforeEach(() => {
  harness = setupDaemonDb();
});

afterEach(() => {
  harness.cleanup();
});

const PLAN_STEP = { id: "s1", name: "Agent turn", agent: "claude", prompt: "p", depends_on: [] };

function insertRun(id: string, values: { agentId?: string; steps?: (typeof PLAN_STEP)[] }): void {
  harness.db
    .insert(schema.runs)
    .values({
      id,
      issue_id: "i1",
      status: "queued",
      branch: `otomat/run/${id}`,
      ...(values.agentId === undefined ? {} : { agent_id: values.agentId }),
      plan_json: { version: 1, steps: values.steps ?? [PLAN_STEP] },
    })
    .run();
}

describe("ensureRuntimeAgent", () => {
  it("defaults to fake, validates against the registry, and upserts the agent row", () => {
    const binDir = mkdtempSync(join(tmpdir(), "otomat-runtime-selection-bin-"));
    try {
      const claudeBin = join(binDir, "claude");
      writeFileSync(claudeBin, "#!/bin/sh\nexit 0\n");
      chmodSync(claudeBin, 0o755);

      expect(ensureRuntimeAgent(harness.db, undefined)).toBe("fake");
      expect(ensureRuntimeAgent(harness.db, "claude", { PATH: binDir })).toBe("claude");
      expect(getAgent(harness.db, "claude")?.runtime).toBe("claude");
      expect(() => ensureRuntimeAgent(harness.db, "bogus")).toThrow(/unknown runtime "bogus"/);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("refuses a real runtime whose binary is not installed", () => {
    expect(() => ensureRuntimeAgent(harness.db, "claude", { PATH: "" })).toThrow(
      /runtime "claude" is unavailable \(binary_not_found\)/,
    );
    expect(getAgent(harness.db, "claude")).toBeUndefined();
  });

  it("refuses the fake runtime outside tests and explicit dev", () => {
    expect(() => ensureRuntimeAgent(harness.db, "fake", { PATH: "" })).toThrow(
      /runtime "fake" is unavailable \(not_enabled\)/,
    );
    expect(() => ensureRuntimeAgent(harness.db, undefined, { PATH: "" })).toThrow(
      /runtime "fake" is unavailable \(not_enabled\)/,
    );
    expect(ensureRuntimeAgent(harness.db, "fake", { OTOMAT_ENABLE_FAKE_RUNTIME: "1" })).toBe(
      "fake",
    );
  });
});

describe("runtimeForRun", () => {
  it("prefers the run's agent row over its frozen plan", () => {
    ensureRuntimeAgent(harness.db, "codex");
    insertRun("r-agent", { agentId: "codex" });

    const run = getRun(harness.db, "r-agent");
    expect(run).toBeDefined();
    expect(runtimeForRun(harness.db, run!)).toBe("codex");
  });

  it("falls back to the frozen plan when the run has no agent row", () => {
    insertRun("r-plan", {});

    const run = getRun(harness.db, "r-plan");
    expect(runtimeForRun(harness.db, run!)).toBe("claude");
  });

  it("returns undefined for a corrupt row with neither agent nor plan step", () => {
    insertRun("r-empty", { steps: [] });

    const run = getRun(harness.db, "r-empty");
    expect(runtimeForRun(harness.db, run!)).toBeUndefined();
  });
});
