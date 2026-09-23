import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { WORKER_JOB_FILE_ENV } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createReexecSpawn } from "#supervisor";

import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DAEMON_ENTRY = resolve(HERE, "..", "..", "src", "index.ts");
const TSX_WORKER = resolve(HERE, "..", "support", "tsx-worker.mjs");
const MARKER = "oto-leak-marker-5c1e";

let root = "";

beforeEach(() => {
  root = setupStubHarness("otomat-worker-env-");
});

afterEach(() => {
  vi.unstubAllEnvs();
  teardownStubHarness(root);
});

function readEnv(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, "utf8"));
}

it("hands the provider its prompt while neither the worker's nor the provider's environment carries it", async () => {
  const bin = join(root, "bin");
  const worktree = join(root, "worktree");
  const sessionDir = join(root, "session");
  mkdirSync(bin);
  mkdirSync(worktree);
  symlinkSync(STUB_BIN, join(bin, "claude"));
  const files = {
    worker: join(root, "worker-env.json"),
    provider: join(root, "provider-env.json"),
    stdin: join(root, "provider-stdin.jsonl"),
  };
  vi.stubEnv("PATH", `${bin}${delimiter}${process.env.PATH ?? ""}`);
  vi.stubEnv("ELECTRON_RUN_AS_NODE", "1");
  vi.stubEnv("OTOMAT_DAEMON_PORT", "4320");
  vi.stubEnv("STUB_WORKER_ENTRY", DAEMON_ENTRY);
  vi.stubEnv("STUB_WORKER_ENV_FILE", files.worker);
  vi.stubEnv("STUB_ENV_FILE", files.provider);
  vi.stubEnv("STUB_STDIN_FILE", files.stdin);
  vi.stubEnv("STUB_STREAM_INPUT", "1");
  vi.stubEnv("STUB_FIXTURE", stubFixture("claude-init-only.jsonl"));

  const proc = createReexecSpawn(TSX_WORKER)({
    runId: "run-env",
    stepRunId: "step-env",
    agentSessionId: "session-env",
    prompt: `Fix the bug ${MARKER}`,
    images: [],
    agentSessionDir: sessionDir,
    worktreePath: worktree,
    runtime: "claude",
    config: null,
    mode: "run",
    providerSessionId: null,
  });
  proc.start();

  expect(await proc.exited).toEqual({ code: 0, signal: null });
  expect(readFileSync(files.stdin, "utf8")).toContain(MARKER);

  const workerEnv = readEnv(files.worker);
  const jobFile = workerEnv[WORKER_JOB_FILE_ENV];
  expect(jobFile).toBeDefined();
  expect(JSON.stringify(workerEnv)).not.toContain(MARKER);

  const providerEnv = readEnv(files.provider);
  expect(JSON.stringify(providerEnv)).not.toContain(MARKER);
  expect(Object.keys(providerEnv).filter((key) => key.startsWith("OTOMAT_"))).toEqual([]);
  expect(providerEnv["ELECTRON_RUN_AS_NODE"]).toBeUndefined();
  expect(providerEnv["PATH"]).toContain(bin);
  expect(existsSync(jobFile)).toBe(false);
}, 30_000);
