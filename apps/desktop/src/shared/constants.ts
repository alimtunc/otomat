/** Custom scheme the packaged renderer is served from. The daemon must allow this origin. */
export const APP_SCHEME = "otomat";
export const APP_HOST = "app";
/** Renderer origin in the packaged app, e.g. sent as `Origin` to the daemon's CORS allowlist. */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
/** Path the renderer is loaded from in the packaged app. */
export const APP_START_URL = `${APP_ORIGIN}/`;

/** Loopback host both the daemon binds and the shell talks to. */
export const DAEMON_HOST = "127.0.0.1";

/** How long to wait for `/api/health` before declaring startup failed (recoverable via retry). */
export const HEALTH_TIMEOUT_MS = 30_000;
export const HEALTH_INTERVAL_MS = 200;

/** Grace given to the daemon between SIGTERM and SIGKILL on quit. */
export const DAEMON_TERMINATE_GRACE_MS = 5_000;

/** Bound on reading the login-shell PATH so a misconfigured shell never hangs startup. */
export const USER_PATH_TIMEOUT_MS = 2_000;

/** Dev-only: when set, the main process loads this URL (Vite dev server) instead of the app scheme. */
export const DEV_SERVER_ENV = "OTOMAT_DESKTOP_DEV_SERVER";
