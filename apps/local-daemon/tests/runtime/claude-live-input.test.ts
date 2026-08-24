import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import type { LiveInputItem } from "#runtime/contract";
import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { ClaudeLiveInput, claudeUserFrame } from "#runtime/providers/claude/live-input";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  stdinFrames,
  stubFixture,
  teardownStubHarness,
  type RecordingChannel,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-claude-live-");
  process.env["OTOMAT_STUB_STREAM_INPUT"] = "1";
  process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-init-only.jsonl");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

/** Hands the turn a fixed batch, then holds the channel open exactly as the file-backed one does until the turn stops taking input. */
function channelOf(batch: readonly LiveInputItem[]): RecordingChannel {
  const receipts: Array<{ id: string; error: string | null }> = [];
  return {
    receipts,
    async *items(signal: AbortSignal) {
      yield* batch;
      while (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 5));
    },
    wrote(id, error) {
      receipts.push({ id, error });
    },
  };
}

/** The frame shape the Claude CLI's streaming input reads, asserted literally so a producer regression cannot hide behind its own encoder. */
function userFrame(text: string) {
  return { type: "user", message: { role: "user", content: [{ type: "text", text }] } };
}

it("writes the prompt and every live message as ordered user frames on one invocation", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  const argsFile = join(worktree, "stub-args.json");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
  const channel = channelOf([
    { kind: "message", id: "c1", body: "also update the changelog" },
    { kind: "message", id: "c2", body: "and bump the version" },
  ]);
  const sink = new MemorySink();

  const final = await new ClaudeRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, prompt: "do the work" }),
    sink,
    new AbortController().signal,
    channel,
  );

  expect(final.status).toBe("completed");
  // One process, one session: the live messages joined the invocation that was already running.
  expect(final.provider_session_id).toBe("sess-claude-1");

  const argv: string[] = JSON.parse(readFileSync(argsFile, "utf8"));
  expect(argv[argv.indexOf("--input-format") + 1]).toBe("stream-json");

  expect(stdinFrames(stdinFile)).toEqual([
    userFrame("do the work"),
    userFrame("also update the changelog"),
    userFrame("and bump the version"),
  ]);
  expect(channel.receipts).toEqual([
    { id: "c1", error: null },
    { id: "c2", error: null },
  ]);
});

it("sums each loop's usage but keeps the invocation's running cost total", async () => {
  const channel = channelOf([{ kind: "message", id: "c1", body: "one more thing" }]);

  const final = await new ClaudeRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, prompt: "do the work" }),
    new MemorySink(),
    new AbortController().signal,
    channel,
  );

  // The stub answers one result per user message with per-loop usage and a running total_cost_usd, as the CLI does: tokens sum, cost takes the last total.
  expect(final.usage).toEqual({
    model: "claude-test-1",
    input_tokens: 20,
    output_tokens: 2,
    total_tokens: 22,
    cost_usd: 0.002,
  });
});

it("keeps a plain turn on the same streaming input, closing stdin with no channel to wait for", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;

  const final = await new ClaudeRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, prompt: "do the work" }),
    new MemorySink(),
    new AbortController().signal,
  );

  expect(final.status).toBe("completed");
  expect(stdinFrames(stdinFile)).toEqual([userFrame("do the work")]);
});

it("receipts the refusal and stops the pump when a live write fails", async () => {
  const channel = channelOf([
    { kind: "message", id: "c1", body: "steer" },
    { kind: "message", id: "c2", body: "more" },
  ]);

  await new ClaudeLiveInput(channel).stream(
    () => Promise.reject(new Error("EPIPE")),
    new AbortController().signal,
  );

  expect(channel.receipts).toEqual([{ id: "c1", error: "EPIPE" }]);
});

it("keeps stdin open across a result that answers a live message, closing on the next", async () => {
  const channel = channelOf([{ kind: "message", id: "c1", body: "steer" }]);
  const live = new ClaudeLiveInput(channel);
  const written: string[] = [];

  const stream = live.stream(
    async (chunk) => void written.push(chunk),
    new AbortController().signal,
  );
  while (channel.receipts.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));

  live.onResult();
  const closedEarly = await Promise.race([
    stream.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 20)),
  ]);
  expect(closedEarly).toBe(false);

  live.onResult();
  await stream;
  expect(written).toEqual([claudeUserFrame("steer")]);
  expect(channel.receipts).toEqual([{ id: "c1", error: null }]);
});
