/**
 * What this host can honestly say about its own failures: a bounded, redacted log ring and the
 * `/api` middleware that correlates each failing request to it. Nothing here reads files, the
 * database, or run output — the ring only holds what the API layer recorded about a failure.
 *
 * @packageDocumentation
 */
export { DiagnosticLogRing } from "./log-ring.js";
export { correlatedRequestLog, recordThrownFailure } from "./request-log.js";
