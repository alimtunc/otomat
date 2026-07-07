import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runtimeFinalStateSchema } from "#runtime/contract";
import { runtimeEventSchema } from "#runtime/events";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  STUB_FIXTURES,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-codex-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

const input = (cwd: string | null) => runtimeRunInput({ run_dir: worktree, cwd });

describe("CodexRuntimeAdapter", () => {
  it("maps a recorded codex --json turn onto runtime events and a completed final state", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    // Codex reports tokens but neither model nor cost — both stay null, never invented.
    expect(runtimeFinalStateSchema.parse(final)).toEqual({
      status: "completed",
      provider_session_id: "thread-codex-1",
      usage: {
        model: null,
        input_tokens: 75589,
        output_tokens: 745,
        total_tokens: 76334,
        cost_usd: null,
      },
      error: null,
      event_count: sink.events.length,
    });

    for (const event of sink.events) runtimeEventSchema.parse(event);
    expect(sink.events.every((e) => e.source === "codex")).toBe(true);

    const types = sink.events.map((e) => [e.type, e.payload["fidelity"]]);
    expect(types).toEqual([
      ["runtime.provider_session", "native"],
      ["runtime.log", "native"],
      ["runtime.tool_call", "parsed"],
      ["runtime.tool_call", "parsed"],
      ["runtime.message", "parsed"],
      ["runtime.tool_call", "parsed"],
      ["runtime.message", "parsed"],
      ["runtime.usage", "native"],
    ]);

    const thinking = sink.events.find((e) => e.payload["thinking"] === true);
    expect(thinking?.payload["text"]).toBe("I should write the file.");

    const commandResult = sink.events.find(
      (e) => e.payload["phase"] === "result" && e.payload["tool"] === "command_execution",
    );
    expect(commandResult?.payload["is_error"]).toBe(false);
  });

  it("fails with the provider's error message on turn.failed", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-turn-failed.jsonl");
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.provider_session_id).toBe("thread-codex-2");
    expect(final.error?.message).toBe("model provider rejected the request");
  });

  it("surfaces an [otomat] diagnostic when the provider exits without reporting a result", async () => {
    process.env["OTOMAT_STUB_EXIT"] = "3";
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/codex exited \(3\) without reporting a result/);

    const diagnostic = sink.events.find((e) => e.source === "otomat");
    expect(diagnostic?.type).toBe("runtime.log");
    expect(diagnostic?.payload["text"]).toMatch(
      /^\[otomat\] codex exited \(3\) without reporting a result/,
    );
    expect(final.event_count).toBe(sink.events.length);
  });

  it("fails honestly when the run has no worktree", async () => {
    const adapter = new CodexRuntimeAdapter("/nonexistent/codex-binary");
    const sink = new MemorySink();

    const final = await adapter.run(input(null), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/requires the run's worktree/);
  });

  it("fails with an [otomat] diagnostic when the binary cannot be spawned", async () => {
    const adapter = new CodexRuntimeAdapter("/nonexistent/codex-binary");
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/failed to run codex: spawn .*ENOENT/);

    const diagnostic = sink.events.find((e) => e.source === "otomat");
    expect(diagnostic?.payload["text"]).toMatch(/^\[otomat\] failed to run codex: spawn .*ENOENT/);
  });

  it("resumes via exec resume with the thread id and refuses to resume without one", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();
    const session = runtimeSessionRef("thread-codex-1");

    const final = await adapter.resume(
      session,
      { prompt: "follow up", run_dir: worktree, cwd: worktree },
      sink,
      new AbortController().signal,
    );
    expect(final.status).toBe("completed");

    const argv = JSON.parse(readFileSync(argsFile, "utf8")) as string[];
    // Shape verified against the real codex CLI: exec-level flags must precede the resume subcommand.
    expect(argv).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "resume",
      "thread-codex-1",
      "-",
    ]);

    await expect(
      adapter.resume(
        { ...session, provider_session_id: null },
        { prompt: "follow up", run_dir: worktree, cwd: worktree },
        sink,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/no provider session/);
  });

  it("streams stderr lines as raw_log evidence", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_STDERR"] = "WARN model config fallback";
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    await adapter.run(input(worktree), sink, new AbortController().signal);

    const stderrEvent = sink.events.find((e) => e.payload["stream"] === "stderr");
    expect(stderrEvent?.type).toBe("runtime.log");
    expect(stderrEvent?.payload["text"]).toBe("WARN model config fallback");
  });
});
