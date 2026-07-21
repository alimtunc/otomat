import { issueShortId, shortId } from "@web/lib/ids";
import { describe, expect, it } from "vitest";

describe("shortId", () => {
  it("keeps the first 8 characters", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});

describe("issueShortId", () => {
  it("prefers the tracker's human identifier when the issue is mirrored", () => {
    expect(issueShortId({ id: "0123456789abcdef", source_identifier: "OTO-12" })).toBe("OTO-12");
  });

  it("falls back to the short local id", () => {
    expect(issueShortId({ id: "0123456789abcdef", source_identifier: null })).toBe("01234567");
  });

  it("never renders the external UUID as a label", () => {
    const uuid = "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    expect(issueShortId({ id: uuid, source_identifier: "OTO-36" })).toBe("OTO-36");
  });
});
