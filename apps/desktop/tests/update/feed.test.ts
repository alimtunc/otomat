import { expect, it } from "vitest";

import { feedOf, replaces } from "#main/update/feed";

it("puts a prerelease version on the prerelease feed and a plain one on stable", () => {
  expect(feedOf("0.1.0-alpha.1")).toBe("prerelease");
  expect(feedOf("1.0.0")).toBe("stable");
});

it("takes the narrower feed for a version it cannot parse", () => {
  expect(feedOf("nightly")).toBe("stable");
});

it("moves forward within one feed", () => {
  expect(replaces("0.1.0-alpha.1", "0.1.0-alpha.2")).toBe(true);
  expect(replaces("0.1.0-alpha.9", "0.1.0-alpha.10")).toBe(true);
  expect(replaces("1.0.0", "1.0.1")).toBe(true);
  expect(replaces("1.0.0", "2.0.0")).toBe(true);
});

it("never moves backwards or sideways", () => {
  expect(replaces("0.1.0-alpha.2", "0.1.0-alpha.1")).toBe(false);
  expect(replaces("0.1.0-alpha.1", "0.1.0-alpha.1")).toBe(false);
  expect(replaces("1.0.1", "1.0.0")).toBe(false);
});

it("keeps the two feeds apart in both directions", () => {
  expect(replaces("0.1.0-alpha.1", "0.2.0")).toBe(false);
  expect(replaces("1.0.0", "1.1.0-alpha.1")).toBe(false);
});

it("refuses a version neither side can compare", () => {
  expect(replaces("1.0.0", "latest")).toBe(false);
  expect(replaces("latest", "1.0.0")).toBe(false);
});
