import type { LinearCredentialStore } from "./types.js";

/**
 * Holds the Personal API key for the lifetime of the daemon process and nowhere
 * else. It is never written to SQLite, never logged, never serialized into a
 * response, and never placed in the environment, so a supervised worker that
 * inherits `process.env` cannot inherit it.
 */
export function createLinearCredentialStore(): LinearCredentialStore {
  let apiKey: string | null = null;
  return {
    get: () => apiKey,
    set(value: string) {
      apiKey = value;
    },
    clear() {
      apiKey = null;
    },
  };
}

/**
 * Development-only handoff for running the daemon without the desktop shell.
 * The value is read once and deleted from the environment immediately, before
 * any child process can be spawned with an inherited copy.
 */
export function takeLinearKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const apiKey = env.OTOMAT_LINEAR_API_KEY;
  delete env.OTOMAT_LINEAR_API_KEY;
  return apiKey === undefined || apiKey === "" ? null : apiKey;
}
