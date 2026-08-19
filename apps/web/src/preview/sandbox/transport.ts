import type { DaemonClientConfig } from "@otomat/client";
import { SandboxEventSource } from "@web/preview/sandbox/event-source";
import { sandboxRead } from "@web/preview/sandbox/routes";
import { sandboxUrl } from "@web/preview/sandbox/url";

function requestPath(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.pathname;
  return sandboxUrl(typeof input === "string" ? input : input.url).pathname;
}

function requestMethod(input: RequestInfo | URL, init: RequestInit | undefined): string {
  if (init?.method !== undefined) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : "GET";
}

/** The sandbox owns no daemon, so a write is refused with its own code instead of being pretended. */
function readOnly(method: string, path: string): Response {
  return Response.json(
    {
      error: "sandbox_read_only",
      message: `${method} ${path} needs the pull request's own daemon; the preview sandbox only reads fixtures.`,
    },
    { status: 503 },
  );
}

/**
 * The typed client's own transport seam: fixtures answer as `Response`s, so every payload still
 * goes through the client's zod contracts and no second client exists to drift from them.
 */
export function sandboxTransport(build: string): DaemonClientConfig {
  return {
    fetch: (input, init) => {
      const path = requestPath(input);
      const method = requestMethod(input, init);
      return Promise.resolve(method === "GET" ? sandboxRead(path, build) : readOnly(method, path));
    },
    EventSource: SandboxEventSource,
  };
}
