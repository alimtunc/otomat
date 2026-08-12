import { expect, it } from "vitest";

import { buildContributionPrompt, withCarriedContributions } from "#supervisor/contribution/prompt";

it("passes a lone message through verbatim", () => {
  expect(buildContributionPrompt(["Also add tests for the parser."])).toBe(
    "Also add tests for the parser.",
  );
});

it("labels a batch with its send order and keeps every message intact", () => {
  const prompt = buildContributionPrompt(["first", "second\nwith a newline", "third"]);

  expect(prompt).toContain("The user sent 3 messages while you were working");
  expect(prompt).toContain("--- Message 1 ---\nfirst");
  expect(prompt).toContain("--- Message 2 ---\nsecond\nwith a newline");
  expect(prompt).toContain("--- Message 3 ---\nthird");
  expect(prompt.indexOf("first")).toBeLessThan(prompt.indexOf("third"));
  expect(prompt.endsWith("third")).toBe(true);
});

it("refuses an empty batch instead of sending a blank turn", () => {
  expect(() => buildContributionPrompt([])).toThrow(/at least one message/);
});

it("leaves a turn's own prompt untouched when nothing was waiting for it", () => {
  expect(withCarriedContributions("do the work", [])).toBe("do the work");
});

it("carries what arrived before the turn alongside the turn's own prompt", () => {
  const prompt = withCarriedContributions("do the work", ["use fixtures"]);

  expect(prompt).toContain("do the work");
  expect(prompt).toContain("use fixtures");
  expect(prompt).toContain("before this turn started");
  expect(prompt.indexOf("do the work")).toBeLessThan(prompt.indexOf("use fixtures"));
});

it("is the batch itself when the turn has no prompt of its own", () => {
  expect(withCarriedContributions("", ["just this"])).toBe("just this");
});
