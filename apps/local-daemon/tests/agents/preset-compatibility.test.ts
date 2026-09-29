import { symlinkSync } from "node:fs";
import { delimiter, join } from "node:path";

import type { WorkflowPresetPlan } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { workflowPresetCompatibility } from "#agents";

import { setupTestDb, type TestDb } from "../support/db.js";
import { stubLinuxPlatform } from "../support/platform.js";
import {
  denyCodexSandboxProbe,
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

let t: TestDb;
let worktree: string;

const IMPLEMENT: WorkflowPresetPlan = {
  version: 1,
  steps: [
    {
      id: "implement",
      name: "Implement",
      agent: "codex",
      options: { sandbox: { kind: "value", value: "workspace-write" } },
      depends_on: [],
    },
  ],
};

beforeEach(() => {
  t = setupTestDb("otomat-preset-compat-");
  worktree = setupStubHarness("otomat-preset-compat-bin-");
  stubLinuxPlatform();
  process.env["STUB_FIXTURE_BY_ARGV"] = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help.txt"),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  teardownStubHarness(worktree);
  t.cleanup();
});

function installCodex(): void {
  symlinkSync(STUB_BIN, join(worktree, "codex"));
  vi.stubEnv("PATH", `${worktree}${delimiter}${process.env["PATH"] ?? ""}`);
}

it("keeps a preset launchable while the host sandbox accepts its setting", () => {
  installCodex();

  expect(workflowPresetCompatibility(t.db, IMPLEMENT)).toEqual({ launchable: true, issues: [] });
});

it("names the refused setting in one sentence, leaving the host probe log out", () => {
  installCodex();
  denyCodexSandboxProbe();

  const { launchable, issues } = workflowPresetCompatibility(t.db, IMPLEMENT);

  expect(launchable).toBe(false);
  expect(issues).toEqual([
    {
      node_id: "implement",
      node_name: "Implement",
      error: "option_unsupported",
      message:
        'runtime "codex" does not accept requested "sandbox" value "workspace-write" on this host; pick one of danger-full-access.',
    },
  ]);
});

it("reports a runtime missing from this host without the node turning launchable", () => {
  vi.stubEnv("PATH", worktree);

  const { launchable, issues } = workflowPresetCompatibility(t.db, IMPLEMENT);

  expect(launchable).toBe(false);
  expect(issues).toEqual([
    expect.objectContaining({ node_id: "implement", error: "runtime_unavailable" }),
  ]);
});
