import { describe, expect, it } from "vitest";

import { authorizedFetch, daemonAuthorization } from "#shared/daemon-credentials";

const credentials = () => [
  { url: "http://127.0.0.1:4319", token: "local-token" },
  null,
  { url: "http://127.0.0.1:51000", token: "remote-token" },
];

describe("daemonAuthorization", () => {
  it("matches a request to its daemon by origin, ignoring path and query", () => {
    expect(daemonAuthorization(credentials, "http://127.0.0.1:4319/api/runs?x=1")).toBe(
      "Bearer local-token",
    );
    expect(daemonAuthorization(credentials, "http://127.0.0.1:51000/api/activity/stream")).toBe(
      "Bearer remote-token",
    );
  });

  it("names no bearer for another origin or an unparseable URL", () => {
    expect(daemonAuthorization(credentials, "http://127.0.0.1:9/api/health")).toBeNull();
    expect(daemonAuthorization(credentials, "https://api.github.com/repos")).toBeNull();
    expect(daemonAuthorization(credentials, "not a url")).toBeNull();
  });
});

describe("authorizedFetch", () => {
  it("adds the bearer to a daemon request and forwards the rest as given", async () => {
    const seen: Array<{ url: string; authorization: string | null; accept: string | null }> = [];
    const original = globalThis.fetch;
    // SAFETY: the stub only records what it is called with; the wrapper never reads a Response beyond returning it.
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({
        url: String(input),
        authorization: headers.get("authorization"),
        accept: headers.get("accept"),
      });
      return new Response(null);
    }) as typeof fetch;
    try {
      const doFetch = authorizedFetch(credentials);
      await doFetch("http://127.0.0.1:4319/api/runs", { headers: { accept: "text/event-stream" } });
      await doFetch("https://objects.githubusercontent.com/x");
    } finally {
      globalThis.fetch = original;
    }
    expect(seen).toEqual([
      {
        url: "http://127.0.0.1:4319/api/runs",
        authorization: "Bearer local-token",
        accept: "text/event-stream",
      },
      { url: "https://objects.githubusercontent.com/x", authorization: null, accept: null },
    ]);
  });
});
