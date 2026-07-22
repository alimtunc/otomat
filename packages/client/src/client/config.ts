export interface DaemonClientConfig {
  /** Prefix for every request path. Empty (default) targets the same origin (Vite proxies `/api`). */
  baseUrl?: string;
  fetch?: typeof fetch;
  EventSource?: typeof EventSource;
}
