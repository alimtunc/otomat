import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

/** The two shipped CLIs owe the same resume contract, so the same case runs against both; only the steering level they announce differs. */
const REAL_PROVIDERS = [
  {
    id: "claude",
    create: () => new ClaudeRuntimeAdapter(STUB_BIN),
    fixture: "claude-frames.jsonl",
    providerSessionId: "sess-claude-1",
    steering: "live",
    // Claude reads streaming-input frames, so even a plain resume hands it the prompt as a user message.
    stdin: `${JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "also update the changelog" }] },
    })}\n`,
  },
  {
    id: "codex",
    create: () => new CodexRuntimeAdapter(STUB_BIN),
    fixture: "codex-frames.jsonl",
    providerSessionId: "thread-codex-1",
    steering: "turn_boundary",
    stdin: "also update the changelog",
  },
] as const;

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-steering-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

it.each(REAL_PROVIDERS)(
  "$id steers a live session by resuming it with the queued message",
  async ({ create, fixture, providerSessionId, steering, stdin }) => {
    const stdinFile = join(worktree, "stub-stdin.txt");
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture(fixture);
    process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
    const adapter = create();

    expect(adapter.capabilities.steering).toBe(steering);
    expect(adapter.capabilities.resume).toBe(true);

    const final = await adapter.resume(
      runtimeSessionRef(providerSessionId),
      { prompt: "also update the changelog", run_dir: worktree, cwd: worktree },
      new MemorySink(),
      new AbortController().signal,
    );

    expect(final.status).toBe("completed");
    expect(readFileSync(stdinFile, "utf8")).toBe(stdin);
  },
);
