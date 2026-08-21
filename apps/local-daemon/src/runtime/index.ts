/**
 * Runtime adapter boundary. The `RuntimeAdapter` push-sink contract runs a turn
 * (`run`/`resume`) that resolves on a terminal `RuntimeFinalState` while pushing
 * every event through a `RuntimeSink` in emission order; the runtime never
 * allocates `seq` — the ledger assigns it downstream at persistence time.
 * `cli/` holds the shared CLI turn infrastructure, `providers/<id>/` one folder
 * per supported runtime, `models/` the per-runtime model catalog with its
 * provenance and selection rules, `probe/` the bounded, credential-free reads of
 * an installed binary that feature-detection is built on, and `registry.ts` the
 * catalog everything derives from.
 *
 * @packageDocumentation
 */
export { isFakeRuntimeEnabled, resolveBinaryPath } from "./availability.js";
export { asString, parseJsonRecord } from "./cli/frame-guards.js";
export * from "./contract.js";
export * from "./events.js";
export * from "./errors.js";
export { describeRuntimeModelCatalog } from "./models/catalog.js";
export { ModelSelectionRefusedError, resolveModelSelection } from "./models/resolve.js";
export { clearProviderProbeCache } from "./probe/cache.js";
export { describeProviderOptions } from "./provider-options.js";
export * from "./providers/fake/adapter.js";
export * from "./registry.js";
export * from "./sinks.js";
