import { afterEach, describe, expect, it } from "vitest";

import {
  clearRuntimeModelCatalogCache,
  describeRuntimeModelCatalog,
} from "#runtime/models/catalog";
import { ModelSelectionRefusedError, resolveModelSelection } from "#runtime/models/resolve";

afterEach(() => {
  clearRuntimeModelCatalogCache();
});

describe("runtime model catalog", () => {
  it("serves the simulated runtime's closed catalog with an honest discovery answer", () => {
    const catalog = describeRuntimeModelCatalog("fake");

    expect(catalog.runtime).toBe("fake");
    expect(catalog.allows_custom).toBe(false);
    expect(catalog.discovery.status).toBe("unsupported");
    expect(catalog.models.map((model) => model.id)).toEqual(["fake-fast", "fake-thorough"]);
    expect(catalog.models.every((model) => model.source === "static")).toBe(true);
  });

  it("serves Claude's documented aliases as static, since the CLI lists nothing locally", () => {
    const catalog = describeRuntimeModelCatalog("claude");

    expect(catalog.allows_custom).toBe(true);
    expect(catalog.discovery.status).toBe("unsupported");
    expect(catalog.discovery.detail).toMatch(/no local model listing/i);
    expect(catalog.models.map((model) => model.id)).toEqual(["opus", "sonnet", "fable"]);
    expect(catalog.models.every((model) => model.source === "static")).toBe(true);
  });
});

describe("model selection", () => {
  it("resolves the provider default to no model at all", () => {
    expect(resolveModelSelection("fake", { kind: "provider_default" })).toBeNull();
  });

  it("resolves a catalog entry with the provenance it was listed under", () => {
    expect(resolveModelSelection("fake", { kind: "model", id: "fake-fast" })).toEqual({
      id: "fake-fast",
      source: "static",
    });
  });

  it("accepts an unlisted identifier as manual where the provider takes one", () => {
    expect(resolveModelSelection("claude", { kind: "model", id: "claude-fable-5" })).toEqual({
      id: "claude-fable-5",
      source: "manual",
    });
  });

  it("refuses an unlisted identifier where the runtime takes no custom one, without substituting", () => {
    try {
      resolveModelSelection("fake", { kind: "model", id: "fake-imaginary" });
      expect.unreachable("an unlisted model must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ModelSelectionRefusedError);
      expect((error as ModelSelectionRefusedError).code).toBe("model_unknown");
      expect((error as Error).message).toMatch(/fake-imaginary/);
    }
  });
});
