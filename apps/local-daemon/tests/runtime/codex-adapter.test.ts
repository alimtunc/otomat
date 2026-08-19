import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeFinalStateSchema } from "#runtime/contract";
import { runtimeEventSchema } from "#runtime/events";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { stubLinuxPlatform } from "../support/platform.js";
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
  vi.restoreAllMocks();
  teardownStubHarness(worktree);
});

const input = (cwd: string) => runtimeRunInput({ run_dir: worktree, cwd });

const MISSING_WORKTREE = "/nonexistent/otomat-worktree";

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
      limit: null,
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
    process.env["OTOMAT_STUB_EXITS"] = JSON.stringify({ "sandbox true": 0 });
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

  it("fails honestly when the run's worktree is gone", async () => {
    const adapter = new CodexRuntimeAdapter("/nonexistent/codex-binary");
    const sink = new MemorySink();

    const final = await adapter.run(input(MISSING_WORKTREE), sink, new AbortController().signal);

    expect(final.status).toBe("failed");
    expect(final.error?.message).toMatch(/worktree .* does not exist/);
  });

  it("refuses before spawn when the binary cannot run the sandbox probe", async () => {
    stubLinuxPlatform();
    const adapter = new CodexRuntimeAdapter("/nonexistent/codex-binary");
    const sink = new MemorySink();

    await expect(adapter.run(input(worktree), sink, new AbortController().signal)).rejects.toThrow(
      /Codex sandbox unavailable/,
    );
    expect(sink.events).toEqual([]);
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

    const argv: string[] = JSON.parse(readFileSync(argsFile, "utf8"));
    // Exec-level flags must precede the resume subcommand; the real CLI rejects them after it.
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

  it("keeps the model an exec-level flag, before the resume subcommand, and sends none by default", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
    const adapter = new CodexRuntimeAdapter(STUB_BIN);

    await adapter.run(
      { ...input(worktree), model: "gpt-5.6-sol" },
      new MemorySink(),
      new AbortController().signal,
    );
    expect(JSON.parse(readFileSync(argsFile, "utf8"))).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "--model",
      "gpt-5.6-sol",
      "-",
    ]);

    await adapter.resume(
      runtimeSessionRef("thread-codex-1"),
      { prompt: "follow up", run_dir: worktree, cwd: worktree, model: "gpt-5.6-sol" },
      new MemorySink(),
      new AbortController().signal,
    );
    // `--model` is an exec-level flag, so it precedes `resume` like the other ones.
    expect(JSON.parse(readFileSync(argsFile, "utf8"))).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "--model",
      "gpt-5.6-sol",
      "resume",
      "thread-codex-1",
      "-",
    ]);

    await adapter.run(input(worktree), new MemorySink(), new AbortController().signal);
    expect(JSON.parse(readFileSync(argsFile, "utf8"))).not.toContain("--model");
  });

  it("sends the frozen sandbox, approval and reasoning level before `resume`", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const options = { sandbox: "read-only", approval_policy: "never", reasoning_effort: "xhigh" };

    await adapter.resume(
      runtimeSessionRef("thread-codex-1"),
      { prompt: "follow up", run_dir: worktree, cwd: worktree, options, model: "gpt-5.6-sol" },
      new MemorySink(),
      new AbortController().signal,
    );

    // Every configured flag is exec-level, so all of them precede the resume subcommand.
    expect(JSON.parse(readFileSync(argsFile, "utf8"))).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "read-only",
      "--ask-for-approval",
      "never",
      "-c",
      'model_reasoning_effort="xhigh"',
      "--model",
      "gpt-5.6-sol",
      "resume",
      "thread-codex-1",
      "-",
    ]);
  });

  it("keeps the worktree sandbox and sends no override by default", async () => {
    const argsFile = join(worktree, "stub-args.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;

    await new CodexRuntimeAdapter(STUB_BIN).run(
      input(worktree),
      new MemorySink(),
      new AbortController().signal,
    );

    const argv: string[] = JSON.parse(readFileSync(argsFile, "utf8"));
    expect(argv).toEqual(["exec", "--json", "--sandbox", "workspace-write", "-"]);
  });

  it("asks a one-shot question in a read-only sandbox, sending the selection", () => {
    const adapter = new CodexRuntimeAdapter(STUB_BIN);

    expect(adapter.describeOneShot("gpt-5.6-sol", { reasoning_effort: "xhigh" })).toMatchObject({
      command: STUB_BIN,
      args: [
        "exec",
        "--sandbox",
        "read-only",
        "-c",
        'model_reasoning_effort="xhigh"',
        "--model",
        "gpt-5.6-sol",
        "-",
      ],
      effort: "xhigh",
      preflight: expect.any(Function),
    });
    expect(adapter.describeOneShot(null, {})).toMatchObject({
      command: STUB_BIN,
      args: ["exec", "--sandbox", "read-only", "-"],
      effort: null,
      preflight: expect.any(Function),
    });
  });

  it("preflights the one-shot read-only sandbox with its effective argv", () => {
    stubLinuxPlatform();
    process.env["OTOMAT_STUB_EXITS"] = JSON.stringify({ "sandbox true": 1 });
    process.env["OTOMAT_STUB_STDERRS"] = JSON.stringify({
      "sandbox true": "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted",
    });
    const oneShot = new CodexRuntimeAdapter(STUB_BIN).describeOneShot(null, {});

    expect(() => oneShot.preflight?.(worktree)).toThrow(
      /Agent argv=\["exec","--sandbox","read-only","-"\]/,
    );
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

  it("scrubs inherited Codex session markers without dropping Codex home", async () => {
    const envFile = join(worktree, "stub-env.json");
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
    process.env["OTOMAT_STUB_ENV_FILE"] = envFile;
    const prior = {
      thread: process.env["CODEX_THREAD_ID"],
      payload: process.env["CODEX_REMOTE_PAYLOAD"],
      network: process.env["CODEX_SANDBOX_NETWORK_DISABLED"],
      home: process.env["CODEX_HOME"],
    };
    try {
      process.env["CODEX_THREAD_ID"] = "outer-thread";
      process.env["CODEX_REMOTE_PAYLOAD"] = "outer-payload";
      process.env["CODEX_SANDBOX_NETWORK_DISABLED"] = "1";
      process.env["CODEX_HOME"] = worktree;

      await new CodexRuntimeAdapter(STUB_BIN).run(
        input(worktree),
        new MemorySink(),
        new AbortController().signal,
      );

      const childEnv: unknown = JSON.parse(readFileSync(envFile, "utf8"));
      expect(childEnv).not.toHaveProperty("CODEX_THREAD_ID");
      expect(childEnv).not.toHaveProperty("CODEX_REMOTE_PAYLOAD");
      expect(childEnv).not.toHaveProperty("CODEX_SANDBOX_NETWORK_DISABLED");
      expect(childEnv).toHaveProperty("CODEX_HOME", worktree);
    } finally {
      if (prior.thread === undefined) delete process.env["CODEX_THREAD_ID"];
      else process.env["CODEX_THREAD_ID"] = prior.thread;
      if (prior.payload === undefined) delete process.env["CODEX_REMOTE_PAYLOAD"];
      else process.env["CODEX_REMOTE_PAYLOAD"] = prior.payload;
      if (prior.network === undefined) delete process.env["CODEX_SANDBOX_NETWORK_DISABLED"];
      else process.env["CODEX_SANDBOX_NETWORK_DISABLED"] = prior.network;
      if (prior.home === undefined) delete process.env["CODEX_HOME"];
      else process.env["CODEX_HOME"] = prior.home;
    }
  });
});
