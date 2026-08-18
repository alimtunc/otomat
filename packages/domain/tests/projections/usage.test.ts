import { scopeUsage, stepUsage, type EventEnvelope } from "@otomat/domain";
import { describe, expect, it } from "vitest";

function usageEvent(
  seq: number,
  usage: Record<string, unknown> | null,
  stepRunId: string | null = "step-1",
): EventEnvelope {
  return {
    id: `e${seq}`,
    run_id: "run-1",
    step_run_id: stepRunId,
    agent_session_id: "session-1",
    seq,
    type: "runtime.usage",
    source: "claude",
    occurred_at: "2026-08-16T00:00:00.000Z",
    payload: usage === null ? {} : { usage },
    raw_ref: null,
  };
}

function otherEvent(seq: number): EventEnvelope {
  return { ...usageEvent(seq, null), type: "runtime.message" };
}

describe("scopeUsage totals", () => {
  it("sums each turn's own totals and counts the turns behind them", () => {
    const total = scopeUsage(
      [
        usageEvent(1, { input_tokens: 100, output_tokens: 20, cost_usd: 0.01 }),
        usageEvent(2, { input_tokens: 50, output_tokens: 5, cost_usd: 0.002 }),
        otherEvent(3),
      ],
      true,
    );

    expect(total).toMatchObject({ input: 150, output: 25, costUsd: 0.012, turns: 2 });
  });

  it("leaves a field the provider never reported null instead of zero", () => {
    const total = scopeUsage([usageEvent(1, { input_tokens: 100 })], true);

    expect(total.input).toBe(100);
    expect(total.output).toBeNull();
    expect(total.costUsd).toBeNull();
  });

  it("counts a turn that reported an unreadable usage object as no turn at all", () => {
    expect(scopeUsage([usageEvent(1, null)], true).turns).toBe(0);
  });
});

describe("scopeUsage", () => {
  it("is live while the scope is unsettled, even once figures have arrived", () => {
    const usage = scopeUsage([usageEvent(1, { input_tokens: 10 })], false);

    expect(usage.availability).toBe("live");
    expect(usage.input).toBe(10);
  });

  it("is final once the scope has settled with figures", () => {
    expect(scopeUsage([usageEvent(1, { input_tokens: 10 })], true).availability).toBe("final");
  });

  it("distinguishes an unsettled scope with nothing yet from one that never reported", () => {
    expect(scopeUsage([], false).availability).toBe("live");
    expect(scopeUsage([], true).availability).toBe("unavailable");
  });
});

describe("stepUsage", () => {
  it("attributes only the turns of that step", () => {
    const events = [
      usageEvent(1, { input_tokens: 100 }, "step-1"),
      usageEvent(2, { input_tokens: 900 }, "step-2"),
      usageEvent(3, { input_tokens: 7 }, null),
    ];

    expect(stepUsage(events, "step-1", true).input).toBe(100);
    expect(stepUsage(events, "step-2", true).input).toBe(900);
  });
});
