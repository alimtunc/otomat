import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runtimeFinalStateSchema } from "#runtime/contract";
import { runtimeEventSchema } from "#runtime/events";
import { claudePermissionMode, ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { MemorySink, type RuntimeSink } from "#runtime/sinks";

import { waitFor } from "../support/poll.js";
import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  STUB_FIXTURES,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-claude-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

const input = (cwd: string | null) => runtimeRunInput({ run_dir: worktree, cwd });

describe("ClaudeRuntimeAdapter", () => {
  it("maps a recorded stream-json turn onto runtime events and a completed final state", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-frames.jsonl");
    const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(runtimeFinalStateSchema.parse(final)).toEqual({
      status: "completed",
      provider_session_id: "sess-claude-1",
      // input folds cache creation (75) + cache reads (300) into the raw 100 — usage never understates the turn.
      usage: {
        model: "claude-test-1",
        input_tokens: 475,
        output_tokens: 25,
        total_tokens: 500,
        cost_usd: 0.0123,
      },
      error: null,
      event_count: sink.events.length,
    });

    for (const event of sink.events) runtimeEventSchema.parse(event);
    expect(sink.events.every((e) => e.source === "claude")).toBe(true);
    expect(sink.events.every((e) => e.payload["adapter"] === "claude")).toBe(true);
    expect(sink.events.every((e) => e.payload["test_adapter"] === undefined)).toBe(true);

    const types = sink.events.map((e) => [e.type, e.payload["fidelity"]]);
    expect(types).toEqual([
      ["runtime.log", "native"],
      ["runtime.provider_session", "native"],
      ["runtime.log", "raw_log"],
      ["runtime.message", "parsed"],
      ["runtime.tool_call", "parsed"],
      ["runtime.tool_call", "parsed"],
      ["runtime.log", "native"],
      ["runtime.message", "parsed"],
      ["runtime.usage", "native"],
    ]);

    const [call, result] = sink.events.filter((e) => e.type === "runtime.tool_call");
    expect(call?.payload).toMatchObject({ phase: "call", tool: "Write", tool_use_id: "tu1" });
    expect(result?.payload).toMatchObject({ phase: "result", tool_use_id: "tu1", is_error: false });

    const rawLog = sink.events.find((e) => e.payload["fidelity"] === "raw_log");
    expect(rawLog?.payload["text"]).toBe("plain text noise the CLI printed outside JSON");
  });

  it("fails honestly when the run has no worktree, without spawning the provider", async () => {
    const adapter = new ClaudeRuntimeAdapter("/nonexistent/claude-binary");
    const sink = new MemorySink();

    const final = await adapter.run(input(null), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/requires the run's worktree/);
    expect(final.event_count).toBe(sink.events.length);
  });

  it("fails when the provider exits without a result frame, keeping the session id", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-init-only.jsonl");
    process.env["OTOMAT_STUB_EXIT"] = "1";
    const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.provider_session_id).toBe("sess-claude-1");
    expect(final.error?.message).toMatch(/without reporting a result/);
  });

  it("fails honestly when the binary does not exist", async () => {
    const adapter = new ClaudeRuntimeAdapter("/nonexistent/claude-binary");
    const sink = new MemorySink();

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/failed to run claude/);
  });

  it(
    "aborts a hanging provider, returns canceled, and leaves no orphan process",
    { timeout: 20_000 },
    async () => {
      const pidFile = join(worktree, "stub.pid");
      process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-init-only.jsonl");
      process.env["OTOMAT_STUB_HANG"] = "1";
      process.env["OTOMAT_STUB_PID_FILE"] = pidFile;
      const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
      const sink = new MemorySink();
      const controller = new AbortController();

      const turn = adapter.run(input(worktree), sink, controller.signal);
      expect(await waitFor(() => sink.events.length >= 1 && existsSync(pidFile))).toBe(true);
      controller.abort();

      const final = await turn;
      expect(final.status).toBe("canceled");
      expect(final.provider_session_id).toBe("sess-claude-1");

      const pid = Number(readFileSync(pidFile, "utf8"));
      await waitFor(() => !isAlive(pid));
      expect(isAlive(pid)).toBe(false);
    },
  );

  it("scrubs nested-session markers from the provider environment", async () => {
    const envFile = join(worktree, "stub-env.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-frames.jsonl");
    process.env["OTOMAT_STUB_ENV_FILE"] = envFile;
    const priorClaudeCode = process.env["CLAUDECODE"];
    const priorEntrypoint = process.env["CLAUDE_CODE_ENTRYPOINT"];
    process.env["CLAUDECODE"] = "1";
    process.env["CLAUDE_CODE_ENTRYPOINT"] = "test";
    try {
      const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
      await adapter.run(input(worktree), new MemorySink(), new AbortController().signal);

      const childEnv = JSON.parse(readFileSync(envFile, "utf8")) as Record<string, string>;
      expect(childEnv["CLAUDECODE"]).toBeUndefined();
      expect(childEnv["CLAUDE_CODE_ENTRYPOINT"]).toBeUndefined();
      expect(childEnv["OTOMAT_STUB_FIXTURE"]).toBeDefined();
    } finally {
      if (priorClaudeCode === undefined) delete process.env["CLAUDECODE"];
      else process.env["CLAUDECODE"] = priorClaudeCode;
      if (priorEntrypoint === undefined) delete process.env["CLAUDE_CODE_ENTRYPOINT"];
      else process.env["CLAUDE_CODE_ENTRYPOINT"] = priorEntrypoint;
    }
  });

  it("fails the turn instead of tearing the worker when the sink cannot persist events", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-frames.jsonl");
    const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
    const sink: RuntimeSink = {
      emit() {
        throw new Error("disk full");
      },
    };

    const final = await adapter.run(input(worktree), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/event dispatch failed: disk full/);
    expect(final.event_count).toBe(0);
  });

  it("passes the frozen permission_mode to --permission-mode on run and resume", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
    const adapter = new ClaudeRuntimeAdapter(STUB_BIN);

    await adapter.run(
      { ...input(worktree), options: { permission_mode: "plan" } },
      new MemorySink(),
      new AbortController().signal,
    );
    const runArgv = JSON.parse(readFileSync(argsFile, "utf8")) as string[];
    expect(runArgv[runArgv.indexOf("--permission-mode") + 1]).toBe("plan");

    await adapter.resume(
      runtimeSessionRef("sess-claude-1"),
      {
        prompt: "follow up",
        run_dir: worktree,
        cwd: worktree,
        options: { permission_mode: "plan" },
      },
      new MemorySink(),
      new AbortController().signal,
    );
    const resumeArgv = JSON.parse(readFileSync(argsFile, "utf8")) as string[];
    expect(resumeArgv[resumeArgv.indexOf("--permission-mode") + 1]).toBe("plan");
    expect(resumeArgv.at(-2)).toBe("--resume");
  });

  it("resumes with the provider session id and refuses to resume without one", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
    const adapter = new ClaudeRuntimeAdapter(STUB_BIN);
    const sink = new MemorySink();
    const session = runtimeSessionRef("sess-claude-1");

    const final = await adapter.resume(
      session,
      { prompt: "follow up", run_dir: worktree, cwd: worktree },
      sink,
      new AbortController().signal,
    );
    expect(final.status).toBe("completed");

    const argv = JSON.parse(readFileSync(argsFile, "utf8")) as string[];
    expect(argv.at(-2)).toBe("--resume");
    expect(argv.at(-1)).toBe("sess-claude-1");

    await expect(
      adapter.resume(
        { ...session, provider_session_id: null },
        { prompt: "follow up", run_dir: worktree, cwd: worktree },
        sink,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/no provider session/);
  });
});

describe("claudePermissionMode", () => {
  it("defaults to acceptEdits and honors only known modes — bypass is an explicit opt-in", () => {
    expect(claudePermissionMode({})).toBe("acceptEdits");
    expect(claudePermissionMode({ OTOMAT_CLAUDE_PERMISSION_MODE: "bypassPermissions" })).toBe(
      "bypassPermissions",
    );
    expect(claudePermissionMode({ OTOMAT_CLAUDE_PERMISSION_MODE: "yolo" })).toBe("acceptEdits");
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
