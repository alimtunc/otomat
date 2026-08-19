import { PREVIEW_BUILD_SHA, previewInstanceDeployment } from "@otomat/domain";
import { describe, expect, it } from "vitest";

describe("previewInstanceDeployment", () => {
  it("keys a deployment on the commit, disjoint from the stable one", () => {
    const deployment = previewInstanceDeployment("1a2b3c4");
    expect(deployment.homeSuffix).toBe(".otomat/instances/1a2b3c4");
    expect(deployment.port).toBeGreaterThanOrEqual(43100);
    expect(deployment.port).toBeLessThan(44000);
  });

  it("gives two commits two ports and two directories", () => {
    const one = previewInstanceDeployment("1a2b3c4");
    const other = previewInstanceDeployment("9f8e7d6");
    expect(one.homeSuffix).not.toBe(other.homeSuffix);
    expect(one.port).not.toBe(other.port);
  });

  it("is stable, so the desktop shell and CI provisioning reach the same daemon", () => {
    expect(previewInstanceDeployment("1a2b3c4")).toEqual(previewInstanceDeployment("1a2b3c4"));
  });

  it("parks an unidentifiable build in its own slot rather than the stable deployment", () => {
    expect(previewInstanceDeployment(null)).toEqual(previewInstanceDeployment("nope"));
    expect(previewInstanceDeployment(null).homeSuffix).toBe(".otomat/instances/unknown");
  });

  it("accepts exactly the CI short sha", () => {
    expect(PREVIEW_BUILD_SHA.test("1a2b3c4")).toBe(true);
    expect(PREVIEW_BUILD_SHA.test("1A2B3C4")).toBe(false);
    expect(PREVIEW_BUILD_SHA.test("1a2b3c45")).toBe(false);
  });
});
