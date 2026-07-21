import { afterEach, expect, it, vi } from "vitest";

import { createLinearTransport, LINEAR_REQUEST_TIMEOUT_MS } from "#linear";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("reports a response body read failure explicitly", async () => {
  const response = new Response();
  const streamError = new Error("stream failed");
  vi.spyOn(response, "text").mockRejectedValue(streamError);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

  const request = createLinearTransport()({
    query: "query Test { viewer { name } }",
    variables: {},
    apiKey: "lin_api_secret",
  });

  await expect(request).rejects.toMatchObject({
    code: "linear_request_failed",
    cause: streamError,
  });
});

it("bounds a request that never receives a response", async () => {
  const timeout = new AbortController();
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ),
  );

  const request = createLinearTransport()({
    query: "query Test { viewer { name } }",
    variables: {},
    apiKey: "lin_api_secret",
  });
  timeout.abort();

  await expect(request).rejects.toMatchObject({ code: "linear_unavailable" });
  expect(timeoutSpy).toHaveBeenCalledWith(LINEAR_REQUEST_TIMEOUT_MS);
});

it("reports a timeout while reading the response body as unavailable", async () => {
  const timeout = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const response = new Response(
    new ReadableStream({
      start(controller) {
        timeout.signal.addEventListener("abort", () => controller.error(timeout.signal.reason));
      },
    }),
  );
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

  const request = createLinearTransport()({
    query: "query Test { viewer { name } }",
    variables: {},
    apiKey: "lin_api_secret",
  });
  timeout.abort(new Error("body timed out"));

  await expect(request).rejects.toMatchObject({
    code: "linear_unavailable",
    cause: expect.objectContaining({ message: "body timed out" }),
  });
});
