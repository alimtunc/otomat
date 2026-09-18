import { afterEach, expect, it, vi } from "vitest";

import { createLinearApiClient, LINEAR_FILE_MAX_BYTES } from "#linear";

const KEY = "lin_api_secret";
const UPLOAD = "https://uploads.linear.app/ws/issue/file/screenshot.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const client = createLinearApiClient(async () => {
  throw new Error("GraphQL transport must not run for a file download");
});

function stubFetch(response: Response | Error) {
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("fetches an upload under the key, without following redirects, and streams its bytes", async () => {
  const fetchImpl = stubFetch(
    new Response(PNG, {
      status: 200,
      headers: { "content-type": "image/png; charset=binary", "content-length": "4" },
    }),
  );

  const file = await client.downloadFile(KEY, UPLOAD);

  expect(fetchImpl).toHaveBeenCalledWith(
    UPLOAD,
    expect.objectContaining({ headers: { authorization: KEY }, redirect: "manual" }),
  );
  expect(file.media_type).toBe("image/png");
  expect(file.size).toBe(4);
  expect(new Uint8Array(await new Response(file.body).arrayBuffer())).toEqual(PNG);
});

it("refuses any destination that is not Linear's https upload host before sending the key", async () => {
  const fetchImpl = stubFetch(new Response(PNG, { status: 200 }));
  const refused = { code: "linear_media_refused" };

  await expect(client.downloadFile(KEY, "http://uploads.linear.app/a.png")).rejects.toMatchObject(
    refused,
  );
  await expect(
    client.downloadFile(KEY, "https://uploads.linear.app.evil.io/a.png"),
  ).rejects.toMatchObject(refused);
  await expect(client.downloadFile(KEY, "https://api.linear.app/graphql")).rejects.toMatchObject(
    refused,
  );
  await expect(client.downloadFile(KEY, "javascript:alert(1)")).rejects.toMatchObject(refused);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("refuses a redirect instead of following it", async () => {
  stubFetch(
    new Response(null, { status: 302, headers: { location: "https://elsewhere.test/a.png" } }),
  );

  await expect(client.downloadFile(KEY, UPLOAD)).rejects.toMatchObject({
    code: "linear_media_refused",
  });
});

it("refuses a content type the cockpit does not render", async () => {
  stubFetch(new Response("<script>", { status: 200, headers: { "content-type": "text/html" } }));

  await expect(client.downloadFile(KEY, UPLOAD)).rejects.toMatchObject({
    code: "linear_media_refused",
  });
});

it("refuses a file over the inline size cap", async () => {
  stubFetch(
    new Response(PNG, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(LINEAR_FILE_MAX_BYTES + 1) },
    }),
  );

  await expect(client.downloadFile(KEY, UPLOAD)).rejects.toMatchObject({
    code: "linear_media_refused",
  });
});

it("maps a gone file, a rejected key, an outage and a network failure to their codes", async () => {
  const gone = (status: number) => {
    stubFetch(new Response('{"error":"not found"}', { status }));
    return client.downloadFile(KEY, UPLOAD);
  };

  await expect(gone(404)).rejects.toMatchObject({ code: "linear_media_expired" });
  await expect(gone(410)).rejects.toMatchObject({ code: "linear_media_expired" });
  await expect(gone(403)).rejects.toMatchObject({ code: "linear_media_expired" });
  await expect(gone(401)).rejects.toMatchObject({ code: "linear_unauthorized" });
  await expect(gone(503)).rejects.toMatchObject({ code: "linear_unavailable" });
  stubFetch(new TypeError("fetch failed"));
  await expect(client.downloadFile(KEY, UPLOAD)).rejects.toMatchObject({
    code: "linear_unavailable",
  });
});
