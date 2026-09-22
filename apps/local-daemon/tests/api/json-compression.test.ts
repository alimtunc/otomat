import { gunzipSync } from "node:zlib";

import { insertIssue } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp, request } from "#test-support/api";
import { setupTestDb, type TestDb } from "#test-support/db";

let fixture: TestDb;
beforeEach(() => {
  fixture = setupTestDb("otomat-compression-");
});
afterEach(() => fixture.cleanup());

const GZIP = { "Accept-Encoding": "gzip" };

it("gzips a large JSON body for a client that accepts it, and the body decodes to the same JSON", async () => {
  for (let index = 0; index < 40; index += 1) {
    insertIssue(fixture.db, {
      id: `issue-${index}`,
      project_id: "p1",
      title: `Issue ${index} ${"with a long title ".repeat(4)}`,
    });
  }
  const app = makeApiApp(fixture);
  const plain = await request(app, "/api/issues/catalog?projectId=p1");
  const expected: unknown = await plain.json();

  const encoded = await request(app, "/api/issues/catalog?projectId=p1", { headers: GZIP });

  expect(encoded.headers.get("Content-Encoding")).toBe("gzip");
  expect(encoded.headers.get("Vary")).toContain("Accept-Encoding");
  const bytes = Buffer.from(await encoded.arrayBuffer());
  expect(JSON.parse(gunzipSync(bytes).toString("utf8"))).toEqual(expected);
  expect(bytes.byteLength).toBeLessThan(JSON.stringify(expected).length);
});

it("leaves a JSON body under the threshold as it is", async () => {
  const response = await request(makeApiApp(fixture), "/api/issues/catalog?projectId=p1", {
    headers: GZIP,
  });

  expect(response.headers.get("Content-Encoding")).toBeNull();
  expect(Number(response.headers.get("Content-Length"))).toBeLessThan(1024);
  expect(Array.isArray(await response.json())).toBe(true);
});

it("never encodes an event stream", async () => {
  const response = await request(makeApiApp(fixture), "/api/activity/stream", { headers: GZIP });

  expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  expect(response.headers.get("Content-Encoding")).toBeNull();
  await response.body?.cancel();
});
