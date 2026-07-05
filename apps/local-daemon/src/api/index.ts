/**
 * The daemon's HTTP API surface. `createApiApp` assembles the Hono app
 * (host-guard + CORS on `/api/*`, the route groups, and the JSON 404/500
 * fallthrough); `ApiDeps` is the capability set it is constructed with; the
 * `toX` serializers convert DB rows into wire contracts.
 *
 * @packageDocumentation
 */
export * from "./app.js";
export * from "./deps.js";
export * from "./serialize.js";
