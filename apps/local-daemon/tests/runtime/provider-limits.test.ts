import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { claudeProviderLimit } from "#runtime/providers/claude/limits";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { codexProviderLimit } from "#runtime/providers/codex/limits";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  STUB_FIXTURES,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-limits-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

const input = (cwd: string) => runtimeRunInput({ run_dir: worktree, cwd });

/** The epoch the `claude-usage-limit` fixture prints, as an instant. */
const FIXTURE_RESET = new Date(4_102_444_800 * 1000).toISOString();

describe("claudeProviderLimit", () => {
  it("reads the reset the CLI printed next to the limit it reported", () => {
    expect(
      claudeProviderLimit({
        subtype: "error_during_execution",
        result: "Claude AI usage limit reached|1787220000",
      }),
    ).toEqual({
      reason: "Claude AI usage limit reached|1787220000",
      resume_at: new Date(1_787_220_000 * 1000).toISOString(),
    });
  });

  it("reports the limit without a deadline when the CLI printed no reset", () => {
    expect(claudeProviderLimit({ subtype: "error", result: "rate limit exceeded" })).toEqual({
      reason: "rate limit exceeded",
      resume_at: null,
    });
  });

  // The adapter reports what the CLI said, stale or not; whether that reset can still be scheduled against is the daemon's call.
  it("passes on a reset already behind us rather than editing the evidence", () => {
    expect(
      claudeProviderLimit({ subtype: "error", result: "Claude AI usage limit reached|1600000000" })
        ?.resume_at,
    ).toBe(new Date(1_600_000_000 * 1000).toISOString());
  });

  it("leaves a failure the model itself caused alone", () => {
    expect(claudeProviderLimit({ subtype: "error", result: "tool call failed" })).toBeNull();
  });
});

describe("codexProviderLimit", () => {
  it("recognises the quota in the message Codex reported and claims no deadline", () => {
    expect(codexProviderLimit("You've hit your usage limit. Try again later.")).toEqual({
      reason: "You've hit your usage limit. Try again later.",
      resume_at: null,
    });
  });

  it("leaves an ordinary turn failure alone", () => {
    expect(codexProviderLimit("model provider rejected the request")).toBeNull();
  });
});

describe("provider limits through the adapters", () => {
  it("ends a quota-refused Claude turn as failed, with the reset and the raw frame kept", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "claude-usage-limit.jsonl");
    const sink = new MemorySink();

    const final = await new ClaudeRuntimeAdapter(STUB_BIN).run(
      input(worktree),
      sink,
      new AbortController().signal,
    );

    expect(final.status).toBe("failed");
    expect(final.limit).toEqual({
      provider: "claude",
      reason: "Claude AI usage limit reached|4102444800",
      resume_at: FIXTURE_RESET,
    });
    const limitEvent = sink.events.find((event) => event.type === "runtime.provider_limit");
    expect(limitEvent?.payload).toMatchObject({
      fidelity: "native",
      adapter: "claude",
      resume_at: FIXTURE_RESET,
    });
    expect(limitEvent?.payload["frame"]).toMatchObject({ subtype: "error_during_execution" });
  });

  it("ends a quota-refused Codex turn as failed, honestly without a reset", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-usage-limit.jsonl");
    const sink = new MemorySink();

    const final = await new CodexRuntimeAdapter(STUB_BIN).run(
      input(worktree),
      sink,
      new AbortController().signal,
    );

    expect(final.status).toBe("failed");
    expect(final.limit).toEqual({
      provider: "codex",
      reason: "You've hit your usage limit. Try again later.",
      resume_at: null,
    });
    expect(sink.events.some((event) => event.type === "runtime.provider_limit")).toBe(true);
  });

  it("reports no limit for a Codex turn that failed on its own", async () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-turn-failed.jsonl");
    const sink = new MemorySink();

    const final = await new CodexRuntimeAdapter(STUB_BIN).run(
      input(worktree),
      sink,
      new AbortController().signal,
    );

    expect(final.status).toBe("failed");
    expect(final.limit).toBeNull();
    expect(sink.events.some((event) => event.type === "runtime.provider_limit")).toBe(false);
  });

  // Each adapter declares only what its CLI really does; the scheduler reads this to know whether to expect a deadline.
  it("declares each provider's real quota capability", () => {
    expect(new ClaudeRuntimeAdapter().capabilities.provider_limit).toBe("deadline");
    expect(new CodexRuntimeAdapter().capabilities.provider_limit).toBe("detects");
  });
});
