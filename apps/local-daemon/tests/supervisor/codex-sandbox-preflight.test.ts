import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { listRuns } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { clearProviderProbeCache } from "#runtime";
import { CodexSandboxUnavailableError } from "#runtime/providers/codex/sandbox";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
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
});

afterEach(() => {
  clearProviderProbeCache();
  if (priorPath === undefined) delete process.env.PATH;
  else process.env.PATH = priorPath;
  delete process.env.OTOMAT_CODEX_HELP_FIXTURE;
  delete process.env.OTOMAT_CODEX_SANDBOX_STATE;
  rmSync(directory, { recursive: true, force: true });
  fix.cleanup();
});

it("refuses before persistence and remains launchable after sandbox capability recovery", async () => {
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
