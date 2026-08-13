/**
 * Public surface of `@otomat/domain`: the pure entity state machines, the event
 * envelope, the log redactor every layer shares, and the zod contracts the
 * daemon and client agree on — the single source of domain types. State-machine
 * `transition` throws IllegalTransitionError on an illegal edge; type-only
 * consumers import from the `@otomat/domain/types` subpath instead of this
 * runtime barrel.
 *
 * @packageDocumentation
 */
export * from "./redaction/index.js";
export * from "./state-machines/index.js";
export * from "./events/index.js";
export * from "./contracts/index.js";
export * from "./context/index.js";
export * from "./execution/index.js";
export * from "./patch/index.js";
export * from "./plan/index.js";
export * from "./projections/index.js";
export * from "./report/index.js";
