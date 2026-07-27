import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import {
  clearWorkerStartEvidence,
  releaseWorkerStart,
  waitForWorkerStart,
  workerConsumedStartGate,
} from "#supervisor/start-gate";

let workerDir: string;

beforeEach(() => {
  workerDir = mkdtempSync(join(tmpdir(), "otomat-start-gate-"));
});

afterEach(() => {
  rmSync(workerDir, { recursive: true, force: true });
});

it("reports no consumed gate before a worker takes one", async () => {
  expect(workerConsumedStartGate(workerDir)).toBe(false);

  releaseWorkerStart(workerDir, randomUUID());
  // Released but never taken: the worker reached no provider, so a claimed batch must stay queued.
  expect(workerConsumedStartGate(workerDir)).toBe(false);
});

it("reports a consumed gate once the worker takes it", async () => {
  const token = randomUUID();
  releaseWorkerStart(workerDir, token);

  expect(await waitForWorkerStart(workerDir, token, new AbortController().signal)).toBe(true);
  expect(workerConsumedStartGate(workerDir)).toBe(true);
});

it("forgets the previous turn once the trace is cleared", async () => {
  const token = randomUUID();
  releaseWorkerStart(workerDir, token);
  await waitForWorkerStart(workerDir, token, new AbortController().signal);

  clearWorkerStartEvidence(workerDir);

  // Without this, boot would read an earlier turn's proof and bury the batch claimed for the next one.
  expect(workerConsumedStartGate(workerDir)).toBe(false);
});

it("refuses a gate whose token is not the one the worker was given", async () => {
  releaseWorkerStart(workerDir, randomUUID());
  const controller = new AbortController();
  controller.abort();

  expect(await waitForWorkerStart(workerDir, randomUUID(), controller.signal)).toBe(false);
  expect(workerConsumedStartGate(workerDir)).toBe(false);
});
