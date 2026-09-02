import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const LOCAL_ZONE = "America/New_York";
const FOREIGN_ZONE = "Asia/Tokyo";

const refusedAt = (now: string, result: string) => {
  vi.setSystemTime(new Date(now));
  return claudeProviderLimit({ subtype: "error_during_execution", result });
};

describe("claudeProviderLimit", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", LOCAL_ZONE);
    // Only a process that re-resolves its zone can tell the local branch from the UTC one.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(LOCAL_ZONE);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

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

  it("reports the session limit the CLI phrased in prose, with the clock it named", () => {
    expect(
      refusedAt("2026-09-02T14:00:00.000Z", "You've hit your session limit · resets 6:10pm (UTC)"),
    ).toEqual({
      reason: "You've hit your session limit · resets 6:10pm (UTC)",
      resume_at: "2026-09-02T18:10:59.999Z",
    });
  });

  it("reads the refusal out of the errors a failed turn carries instead of a result", () => {
    vi.setSystemTime(new Date("2026-09-02T14:00:00.000Z"));

    expect(
      claudeProviderLimit({
        subtype: "error_during_execution",
        errors: ["You've hit your session limit · resets 6:10pm (UTC)"],
      }),
    ).toEqual({
      reason: "You've hit your session limit · resets 6:10pm (UTC)",
      resume_at: "2026-09-02T18:10:59.999Z",
    });
  });

  it("waits out the named minute rather than a whole day when the reset is inside it", () => {
    expect(
      refusedAt("2026-09-02T18:10:20.000Z", "You've hit your session limit · resets 6:10pm (UTC)")
        ?.resume_at,
    ).toBe("2026-09-02T18:10:59.999Z");
  });

  it("rolls a whole-hour reset that has already passed today over to tomorrow", () => {
    expect(
      refusedAt("2026-09-02T23:30:00.000Z", "You've hit your session limit · resets 1am (UTC)")
        ?.resume_at,
    ).toBe("2026-09-03T01:00:59.999Z");
  });

  it("reads noon and midnight as the hours the CLI meant by them", () => {
    expect(
      refusedAt("2026-09-02T14:00:00.000Z", "You've hit your session limit · resets 12am (UTC)")
        ?.resume_at,
    ).toBe("2026-09-03T00:00:59.999Z");
    expect(
      refusedAt("2026-09-02T09:00:00.000Z", "You've hit your session limit · resets 12pm (UTC)")
        ?.resume_at,
    ).toBe("2026-09-02T12:00:59.999Z");
  });

  it("reads a reset the CLI stamped with its own zone, which is this daemon's", () => {
    expect(
      refusedAt(
        "2026-09-02T14:00:00.000Z",
        `You've hit your session limit · resets 6:10pm (${LOCAL_ZONE})`,
      )?.resume_at,
    ).toBe("2026-09-02T22:10:59.999Z");
  });

  it("reads a reset the CLI left unqualified in that same zone", () => {
    expect(
      refusedAt("2026-09-02T09:00:00.000Z", "You've hit your session limit · resets 11:30pm")
        ?.resume_at,
    ).toBe("2026-09-03T03:30:59.999Z");
  });

  it("reports no deadline when the reset is in a zone this process cannot place", () => {
    expect(
      refusedAt(
        "2026-09-02T14:00:00.000Z",
        `You've hit your session limit · resets 6:10pm (${FOREIGN_ZONE})`,
      ),
    ).toEqual({
      reason: `You've hit your session limit · resets 6:10pm (${FOREIGN_ZONE})`,
      resume_at: null,
    });
  });

  it("reports no deadline when the CLI dated the reset instead of clocking it", () => {
    expect(
      refusedAt(
        "2026-09-02T14:00:00.000Z",
        "You've hit your weekly limit · resets Sep 4, 6:10pm (UTC)",
      )?.resume_at,
    ).toBeNull();
  });

  it("reports no deadline when the clock names no real hour", () => {
    expect(
      refusedAt("2026-09-02T14:00:00.000Z", "You've hit your session limit · resets 13pm (UTC)")
        ?.resume_at,
    ).toBeNull();
  });

  it("recognises a billing refusal the CLI never phrased as hitting a limit", () => {
    expect(
      claudeProviderLimit({
        subtype: "error_during_execution",
        errors: ["spend limit reached (daily; resets 2026-08-08 00:00 UTC) — request an increase"],
      }),
    ).toEqual({
      reason: "spend limit reached (daily; resets 2026-08-08 00:00 UTC) — request an increase",
      resume_at: null,
    });
  });

  it("still recognises the limit code the API returns with no prose around it", () => {
    expect(
      claudeProviderLimit({
        subtype: "error",
        result: 'API Error: 429 {"type":"rate_limit_error"}',
      }),
    ).not.toBeNull();
  });

  it("leaves a failure the model itself caused alone", () => {
    expect(claudeProviderLimit({ subtype: "error", result: "tool call failed" })).toBeNull();
    expect(
      claudeProviderLimit({ subtype: "error", result: "fixed the smart quotation marks" }),
    ).toBeNull();
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
