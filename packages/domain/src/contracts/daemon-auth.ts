/** The daemon refuses to serve without it. */
export const DAEMON_API_TOKEN_ENV = "OTOMAT_API_TOKEN";

/** The one route a caller may reach without the token: liveness probes run before any secret is shared. */
export const DAEMON_HEALTH_PATH = "/api/health";
