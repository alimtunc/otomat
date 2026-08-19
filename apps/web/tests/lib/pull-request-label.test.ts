import { pullRequestLabel } from "@web/lib/pull-request/label";
import { describe, expect, it } from "vitest";

describe("pullRequestLabel", () => {
  it("names the repository the URL carries, with the number", () => {
    expect(
      pullRequestLabel({ url: "https://github.com/alimtunc/otomat/pull/142", number: 142 }),
    ).toBe("alimtunc/otomat#142");
  });

  it("keeps the number alone when no URL names a repository", () => {
    expect(pullRequestLabel({ url: null, number: 142 })).toBe("#142");
    expect(pullRequestLabel({ url: "https://github.com/alimtunc/otomat", number: 142 })).toBe(
      "#142",
    );
  });

  it("keeps the repository alone when GitHub confirmed no number", () => {
    expect(
      pullRequestLabel({ url: "https://github.com/alimtunc/otomat/pull/142", number: null }),
    ).toBe("alimtunc/otomat");
  });

  it("never invents an identity it was given neither half of", () => {
    expect(pullRequestLabel({ url: null, number: null })).toBe("Pull request");
    expect(pullRequestLabel({ url: "https://example.test/elsewhere", number: null })).toBe(
      "Pull request",
    );
  });
});
