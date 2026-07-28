import type { RuntimeModelCatalog } from "@otomat/domain";
import { vi } from "vitest";

/** A runtime model catalog with the shape the daemon returns, for surfaces that render a model picker. */
export function modelCatalog(overrides: Partial<RuntimeModelCatalog> = {}): RuntimeModelCatalog {
  return {
    runtime: "claude",
    allows_custom: true,
    discovery: { status: "unsupported", detail: "No local model listing on this runtime." },
    models: [{ id: "opus", label: "Opus", description: null, source: "static" }],
    ...overrides,
  };
}

/** What `useRuntimeModels` resolves to in a mocked `@web/api/daemon/queries`; called from inside the hook so the module mock stays hoistable. */
export function modelCatalogQueryResult(catalog: RuntimeModelCatalog = modelCatalog()) {
  return {
    data: catalog,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}
