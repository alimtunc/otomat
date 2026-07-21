import type { LinearCredentialStore } from "./types.js";

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

export function takeLinearKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const apiKey = env.OTOMAT_LINEAR_API_KEY;
  delete env.OTOMAT_LINEAR_API_KEY;
  return apiKey === undefined || apiKey === "" ? null : apiKey;
}
