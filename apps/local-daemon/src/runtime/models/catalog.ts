import type { RuntimeModelCatalog } from "@otomat/domain";

import { createRuntimeAdapter, type KnownRuntimeId } from "../registry.js";
import type { RuntimeModelSupport } from "./support.js";

/** A bundled provider catalog only changes when its binary does, so a short cache keeps launches from re-probing on every step. */
const CATALOG_TTL_MS = 5 * 60_000;

interface CachedCatalog {
  expiresAt: number;
  catalog: RuntimeModelCatalog;
}

const cache = new Map<string, CachedCatalog>();

export function clearRuntimeModelCatalogCache(): void {
  cache.clear();
}

function buildCatalog(runtime: string, support: RuntimeModelSupport): RuntimeModelCatalog {
  const probe = support.discover();
  return {
    runtime,
    allows_custom: support.allowsCustom,
    discovery: probe.discovery,
    models: [...probe.models, ...support.staticModels],
  };
}

/** A failed probe is not cached, so a transient failure never freezes an empty catalog. */
export function describeRuntimeModelCatalog(runtime: KnownRuntimeId): RuntimeModelCatalog {
  const cached = cache.get(runtime);
  if (cached && cached.expiresAt > Date.now()) return cached.catalog;

  const catalog = buildCatalog(runtime, createRuntimeAdapter(runtime).models);
  if (catalog.discovery.status !== "failed") {
    cache.set(runtime, { expiresAt: Date.now() + CATALOG_TTL_MS, catalog });
  }
  return catalog;
}
