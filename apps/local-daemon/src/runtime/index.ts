/**
 * Runtime adapter boundary. The `RuntimeAdapter` push-sink contract runs a turn
 * (`run`/`resume`) that resolves on a terminal `RuntimeFinalState` while pushing
 * every event through a `RuntimeSink` in emission order; the runtime never
 * allocates `seq` — the ledger assigns it downstream at persistence time.
 * `cli/` holds the shared CLI turn infrastructure, `providers/<id>/` one folder
 * per supported runtime, and `registry.ts` the catalog everything derives from.
 *
 * @packageDocumentation
 */
export * from "./contract.js";
export * from "./events.js";
export * from "./providers/fake/adapter.js";
export * from "./registry.js";
export * from "./sinks.js";
