/**
 * Typed daemon API/SSE client for the frontend.
 *
 * `createDaemonClient` is the entry point: its methods validate every response against
 * a zod contract (throwing on drift) and throw `DaemonRequestError` on a non-2xx status;
 * `subscribeRunEvents` opens a reconnecting SSE stream of a run's events.
 *
 * @packageDocumentation
 */
export * from "./client";
export * from "./types";
