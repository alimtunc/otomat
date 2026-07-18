import { formatCostUsd, formatTokenCount, latestReportedUsage } from "@web/lib/run-usage";
import { expect, it } from "vitest";

import { envelope } from "#support/envelope";

it("returns null when the ledger has no usage event", () => {
  expect(
    latestReportedUsage([envelope({ type: "runtime.log", payload: { text: "hi" } })]),
  ).toBeNull();
});

it("reads the last usage event field by field, keeping unreported fields null", () => {
  const events = [
    envelope({
      seq: 0,
      type: "runtime.usage",
      payload: { usage: { model: "m1", input_tokens: 1, output_tokens: 2, cost_usd: 0.5 } },
    }),
    envelope({
      seq: 1,
      type: "runtime.usage",
      payload: { usage: { model: null, input_tokens: 100, output_tokens: 20, cost_usd: null } },
    }),
  ];
  expect(latestReportedUsage(events)).toEqual({
    model: null,
    inputTokens: 100,
    outputTokens: 20,
    costUsd: null,
  });
});

it("ignores a usage event with a malformed payload", () => {
  expect(
    latestReportedUsage([envelope({ type: "runtime.usage", payload: { usage: "?" } })]),
  ).toBeNull();
});

it("formats token counts and cost without inventing precision", () => {
  expect(formatTokenCount(999)).toBe("999");
  expect(formatTokenCount(18_400)).toBe("18.4k");
  expect(formatTokenCount(230_000)).toBe("230k");
  expect(formatCostUsd(0.087)).toBe("$0.087");
});
