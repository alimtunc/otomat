import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import {
  getRun,
  insertAgentProfile,
  listAgentSessionsForRun,
  listRuns,
  updateAgentProfile,
  writeExecutionDefaults,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ProfileOptionUnsupportedError } from "#agents";
import { clearProviderProbeCache } from "#runtime";
import {
  clearCodexSandboxProbeCache,
  CodexSandboxUnavailableError,
} from "#runtime/providers/codex/sandbox";

import { contributeToStep } from "../support/contribution.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubLinuxPlatform } from "../support/platform.js";
import { seedWorkflowRun } from "../support/seed.js";
import { stubFixture } from "../support/stub-harness.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;
let directory: string;
let stateFile: string;
let priorPath: string | undefined;

beforeEach(() => {
  fix = setupDaemonDb();
  directory = mkdtempSync(join(tmpdir(), "otomat-codex-preflight-"));
  stateFile = join(directory, "sandbox-state");
  const binary = join(directory, "codex");
  writeFileSync(
    binary,
    [
      "#!/bin/sh",
      'if [ "$1 $2" = "exec --help" ]; then',
      '  cat "$OTOMAT_CODEX_HELP_FIXTURE"',
      "  exit 0",
      "fi",
      'if [ "$1" = "--version" ]; then',
      '  printf "%s\\n" "codex-cli 0.148.0"',
      "  exit 0",
      "fi",
      'if [ "$1" = "sandbox" ] && [ "$(cat "$OTOMAT_CODEX_SANDBOX_STATE")" = "fail" ]; then',
      '  printf "%s\\n" "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted" >&2',
      "  exit 1",
      "fi",
      "exit 0",
    ].join("\n"),
  );
  chmodSync(binary, 0o755);
  writeFileSync(stateFile, "fail");
  priorPath = process.env.PATH;
  process.env.PATH = `${directory}${delimiter}${priorPath ?? ""}`;
  process.env.OTOMAT_CODEX_HELP_FIXTURE = stubFixture("codex-exec-help.txt");
  process.env.OTOMAT_CODEX_SANDBOX_STATE = stateFile;
  clearProviderProbeCache();
  clearCodexSandboxProbeCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearProviderProbeCache();
  clearCodexSandboxProbeCache();
  if (priorPath === undefined) delete process.env.PATH;
  else process.env.PATH = priorPath;
  delete process.env.OTOMAT_CODEX_HELP_FIXTURE;
  delete process.env.OTOMAT_CODEX_SANDBOX_STATE;
  rmSync(directory, { recursive: true, force: true });
  fix.cleanup();
});

it("refuses before persistence and remains launchable after sandbox capability recovery", async () => {
  stubLinuxPlatform();
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const request = { prompt: "Run pwd", runtime: "codex" } as const;

  await expect(supervisor.start(request)).rejects.toBeInstanceOf(CodexSandboxUnavailableError);
  expect(listRuns(fix.db)).toEqual([]);
  expect(spawn.jobs).toEqual([]);

  writeFileSync(stateFile, "ok");
  const run = await supervisor.start(request);
  await supervisor.settle();

  expect(run.status).toBe("queued");
  expect(listRuns(fix.db)).toHaveLength(1);
  expect(spawn.jobs).toHaveLength(1);
  expect(spawn.jobs[0]?.config?.options.sandbox).toBe("workspace-write");
});

it("resumes only the next runtime when an earlier Codex step is already complete", async () => {
  stubLinuxPlatform();
  seedWorkflowRun(fix.db, {
    runId: "mixed-runtime",
    runStatus: "awaiting_human",
    steps: [
      {
        id: "codex-complete",
        status: "succeeded",
        agent: "codex",
        name: "Completed Codex step",
        prompt: "done",
        session: { status: "terminated", providerSessionId: "codex-thread" },
      },
      {
        id: "fake-next",
        status: "queued",
        dependsOn: ["codex-complete"],
        name: "Next fake step",
        prompt: "continue",
      },
    ],
  });
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  expect(supervisor.resumePlan("mixed-runtime")).toEqual({
    mode: "next_step",
    step_name: "Next fake step",
  });
  await supervisor.resume("mixed-runtime");
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(1);
  expect(spawn.jobs[0]?.runtime).toBe("fake");
  expect(getRun(fix.db, "mixed-runtime")?.status).toBe("review_ready");
});

it("persists explicit Codex permissions through launch, Resume and follow-up after preferences change", async () => {
  process.env.OTOMAT_CODEX_HELP_FIXTURE = stubFixture("codex-exec-help-0.153.4.txt");
  const full = { sandbox: "danger-full-access", approval_policy: "never" };
  const profile = {
    name: "Explicit Full",
    runtime: "codex",
    model: null,
    options_json: full,
    guidance: null,
    skill_ids_json: [],
  };
  insertAgentProfile(fix.db, { id: "full", ...profile });
  const { supervisor, spawn } = makeSupervisor(fix, ["fail", "complete", "complete"]);
  const run = await supervisor.start({ prompt: "Return OK", profile_id: "full" });
  await supervisor.settle();
  const session = listAgentSessionsForRun(fix.db, run.id).at(-1);
  if (!session) throw new Error("expected a persisted session");
  expect(session.config_json?.options).toEqual(full);
  expect(getRun(fix.db, run.id)?.plan_json.steps[0]).toMatchObject({ config: { options: full } });

  updateAgentProfile(fix.db, "full", { ...profile, options_json: { sandbox: "read-only" } });
  writeExecutionDefaults(fix.db, {
    runtime: "codex",
    model: null,
    options: { sandbox: "read-only" },
  });
  await supervisor.resume(run.id);
  await supervisor.settle();
  await contributeToStep(fix.db, supervisor, run.id, session.step_run_id, "Return OK again");
  await supervisor.settle();

  expect(spawn.jobs.map((job) => job.config?.options)).toEqual([full, full, full]);
  expect(spawn.jobs.map((job) => job.mode)).toEqual(["run", "resume", "resume"]);
  expect(
    listAgentSessionsForRun(fix.db, run.id).every(
      (row) =>
        row.config_json?.options.sandbox === "danger-full-access" &&
        row.config_json.options.approval_policy === "never",
    ),
  ).toBe(true);
  expect(getRun(fix.db, run.id)?.plan_json).toEqual(run.plan_json);
});

it("refuses incompatible Codex permissions from host preferences instead of dropping them", async () => {
  process.env.OTOMAT_CODEX_HELP_FIXTURE = stubFixture("codex-exec-help-0.153.4.txt");
  writeFileSync(stateFile, "ok");
  writeExecutionDefaults(fix.db, {
    runtime: "codex",
    model: null,
    options: { sandbox: "workspace-write", approval_policy: "on-request" },
  });
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  await expect(supervisor.start({ prompt: "Return OK", runtime: "codex" })).rejects.toBeInstanceOf(
    ProfileOptionUnsupportedError,
  );
  expect(listRuns(fix.db)).toEqual([]);
  expect(spawn.jobs).toEqual([]);
});
