/**
 * Zod contracts shared by daemon and client: HTTP request/response shapes
 * (`api`), the canonical run diff with its pin-to-SHA anchors (`diff`), and the
 * persisted entity mirrors (`entities`). Parsing a payload through these schemas
 * is what guarantees both sides agree on wire shape and invariants.
 *
 * @packageDocumentation
 */
export * from "./api.js";
export * from "./diff.js";
export * from "./entities.js";
