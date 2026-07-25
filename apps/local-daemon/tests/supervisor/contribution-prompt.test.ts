import { expect, it } from "vitest";

import { buildContributionPrompt } from "#supervisor/contribution-prompt";

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
