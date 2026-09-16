/**
 * The daemon's HTTP API surface. `createApiApp` assembles the Hono app
 * (host-guard, CORS and the bearer guard on `/api/*`, the route groups, and the
 * JSON 404/500 fallthrough); `ApiDeps` is the capability set it is constructed with.
 *
 * @packageDocumentation
 */
export * from "./app.js";
export * from "./deps.js";
export { takeDaemonApiToken } from "./security.js";
