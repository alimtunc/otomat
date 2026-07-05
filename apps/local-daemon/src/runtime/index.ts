/**
 * Runtime adapter boundary. The `RuntimeAdapter` push-sink contract runs a turn
 * (`run`/`resume`) that resolves on a terminal `RuntimeFinalState` while pushing
 * every event through a `RuntimeSink` in emission order; the runtime never
 * allocates `seq` — the ledger assigns it downstream at persistence time. Also
 * exports the capability model, sink implementations, and the deterministic
 * `FakeRuntimeAdapter`.
 *
 * @packageDocumentation
 */
export * from "./capabilities.js";
export * from "./events.js";
export * from "./contract.js";
export * from "./sinks.js";
export * from "./fake/fake-adapter.js";
