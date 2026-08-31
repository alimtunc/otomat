import {
  formatCostUsd,
  formatExactTokenCount,
  formatTokenCount,
  latestReportedUsage,
} from "@web/lib/run/usage";
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

it("formats token counts in readable tiers of at most 3 significant digits", () => {
  expect(formatTokenCount(0)).toBe("0");
  expect(formatTokenCount(999)).toBe("999");
  expect(formatTokenCount(9_412)).toBe("9.41k");
  expect(formatTokenCount(18_400)).toBe("18.4k");
  expect(formatTokenCount(230_000)).toBe("230k");
  expect(formatTokenCount(999_950)).toBe("1M");
  expect(formatTokenCount(33_400_000)).toBe("33.4M");
  expect(formatTokenCount(5_350_000_000)).toBe("5.35B");
});

it("exposes the exact integer with thousands separators for hover", () => {
  expect(formatExactTokenCount(999)).toBe("999");
  expect(formatExactTokenCount(33_412_001)).toBe("33,412,001");
});

it("formats costs as USD with two decimals and separators", () => {
  expect(formatCostUsd(0.087)).toBe("$0.09");
  expect(formatCostUsd(4)).toBe("$4.00");
  expect(formatCostUsd(1_234.5)).toBe("$1,234.50");
});
