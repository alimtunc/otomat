import { PREVIEW_BUILD_SHA } from "@otomat/domain";
import { expect, it } from "vitest";

it("accepts exactly the CI short sha", () => {
  expect(PREVIEW_BUILD_SHA.test("1a2b3c4")).toBe(true);
  expect(PREVIEW_BUILD_SHA.test("1A2B3C4")).toBe(false);
  expect(PREVIEW_BUILD_SHA.test("1a2b3c45")).toBe(false);
  expect(PREVIEW_BUILD_SHA.test("")).toBe(false);
});
