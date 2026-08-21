/**
 * Typed daemon API/SSE client for the frontend.
 *
 * `createDaemonClient` is the entry point: its methods validate every response against
 * a zod contract (throwing on drift), throw `DaemonRequestError` on a non-2xx status and
 * `DaemonTransportError` when no daemon answered at all;
 * `subscribeRunEvents` opens a reconnecting SSE stream of a run's events.
 *
 * @packageDocumentation
 */
export * from "./client/index.js";
export { DaemonRequestError, DaemonTransportError } from "./client/http.js";
export * from "./client/config.js";
export type { ActivityStreamHandlers, ActivityStreamSubscription } from "./client/activity.js";
export type { RunEventsHandlers, RunEventsSubscription } from "./client/events.js";
