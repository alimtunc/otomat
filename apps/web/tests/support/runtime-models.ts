import type { RuntimeModelCatalog } from "@otomat/domain";
import { vi } from "vitest";

export function modelCatalog(overrides: Partial<RuntimeModelCatalog> = {}): RuntimeModelCatalog {
  return {
    runtime: "claude",
    allows_custom: true,
    discovery: { status: "unsupported", detail: "No local model listing on this runtime." },
    models: [{ id: "opus", label: "Opus", description: null, source: "static" }],
    ...overrides,
  };
}

export function modelCatalogQueryResult(catalog: RuntimeModelCatalog = modelCatalog()) {
  return {
    data: catalog,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}
