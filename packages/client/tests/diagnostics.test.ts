import { CORRELATION_ID_HEADER } from "@otomat/domain";
import { expect, it } from "vitest";

import { DaemonRequestError, DaemonTransportError } from "#client/client/http";
import { createDaemonClient } from "#client/client/index";

import { jsonResponse } from "./support/response.js";

const unreachableHost: typeof fetch = async () => {
  throw new TypeError("fetch failed");
};

it("carries the method, path and the daemon's correlation id on a failed request", async () => {
  const client = createDaemonClient({
    fetch: async () =>
      jsonResponse({ error: "run_launch_failed" }, 500, {
        [CORRELATION_ID_HEADER]: "req_abc123",
      }),
  });

  const error = await client.startRun({ prompt: "go" }).catch((thrown: unknown) => thrown);

  if (!(error instanceof DaemonRequestError)) throw new Error("expected a DaemonRequestError");
  const failure = error;
  expect(failure.status).toBe(500);
  expect(failure.method).toBe("POST");
  expect(failure.path).toBe("/api/runs");
  expect(failure.correlationId).toBe("req_abc123");
});

it("reports a null correlation id rather than inventing one", async () => {
  const client = createDaemonClient({
    fetch: async () => jsonResponse({ error: "run_not_found" }, 404),
  });

  const error = await client.getRun("missing").catch((thrown: unknown) => thrown);

  if (!(error instanceof DaemonRequestError)) throw new Error("expected a DaemonRequestError");
  expect(error.correlationId).toBeNull();
});

it("separates a request that never reached a host from one the daemon answered", async () => {
  const client = createDaemonClient({ fetch: unreachableHost });

  const error = await client.health().catch((thrown: unknown) => thrown);

  expect(error).not.toBeInstanceOf(DaemonRequestError);
  if (!(error instanceof DaemonTransportError)) throw new Error("expected a DaemonTransportError");
  const failure = error;
  expect(failure.method).toBe("GET");
  expect(failure.path).toBe("/api/health");
  expect(failure.cause).toBeInstanceOf(TypeError);
});

it("asks the active host for one correlation id's excerpt", async () => {
  const paths: string[] = [];
  const fetchMock: typeof fetch = async (input) => {
    paths.push(String(input));
    return jsonResponse({ correlation_id: "req_abc123", truncated: false, entries: [] });
  };
  const client = createDaemonClient({ baseUrl: "http://127.0.0.1:4319", fetch: fetchMock });

  const excerpt = await client.daemonLogExcerpt("req_abc123");

  expect(paths).toEqual(["http://127.0.0.1:4319/api/diagnostics/logs?correlation_id=req_abc123"]);
  expect(excerpt).toEqual({ correlation_id: "req_abc123", truncated: false, entries: [] });
});
