/**
 * The daemon's HTTP API surface. `createApiApp` assembles the Hono app
 * (host, origin and token guards + CORS on `/api/*`, the route groups, and the JSON 404/500
 * fallthrough); `ApiDeps` is the capability set it is constructed with.
 *
 * @packageDocumentation
 */
export * from "./app.js";
export * from "./daemon-token.js";
export * from "./deps.js";
