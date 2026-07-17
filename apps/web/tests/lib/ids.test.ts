import { issueShortId, shortId } from "@web/lib/ids";
import { describe, expect, it } from "vitest";

describe("shortId", () => {
  it("keeps the first 8 characters", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});

describe("issueShortId", () => {
  it("prefers the external id when the issue is mirrored", () => {
    expect(issueShortId({ id: "0123456789abcdef", source_external_id: "OTO-12" })).toBe("OTO-12");
  });

  it("falls back to the short local id", () => {
    expect(issueShortId({ id: "0123456789abcdef", source_external_id: null })).toBe("01234567");
  });
});
