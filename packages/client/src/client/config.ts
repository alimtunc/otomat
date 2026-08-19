/** The slice of the EventSource contract the SSE subscription actually drives. */
export interface DaemonEventSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
}

export interface DaemonClientConfig {
  /** Prefix for every request path. Empty (default) targets the same origin (Vite proxies `/api`). */
  baseUrl?: string;
  fetch?: typeof fetch;
  EventSource?: new (url: string) => DaemonEventSource;
}
