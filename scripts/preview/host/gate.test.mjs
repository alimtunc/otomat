import assert from "node:assert/strict";
import { test } from "node:test";

import { authorizedClient, CLIENT_ID_HEADER, CLIENT_SECRET_HEADER, daemonUrl } from "./gate.mjs";

const ENV = { PREVIEW_CLIENT_ID: "preview-id", PREVIEW_CLIENT_SECRET: "preview-secret" };

function headers(id, secret) {
  const value = new Headers();
  if (id !== null) value.set(CLIENT_ID_HEADER, id);
  if (secret !== null) value.set(CLIENT_SECRET_HEADER, secret);
  return value;
}

test("admits exactly the configured client pair", async () => {
  assert.equal(await authorizedClient(headers("preview-id", "preview-secret"), ENV), true);
  assert.equal(await authorizedClient(headers("preview-id", "wrong"), ENV), false);
  assert.equal(await authorizedClient(headers("wrong", "preview-secret"), ENV), false);
  assert.equal(await authorizedClient(headers(null, null), ENV), false);
});

test("refuses everybody while the worker carries no client pair", async () => {
  assert.equal(await authorizedClient(headers("", ""), {}), false);
  assert.equal(
    await authorizedClient(headers("preview-id", "preview-secret"), {
      PREVIEW_CLIENT_ID: "preview-id",
    }),
    false,
  );
});

test("rewrites the upstream to the loopback origin the daemon's hostGuard admits", () => {
  const url = daemonUrl("https://otomat-preview-pr-142.example.workers.dev/api/runs?limit=5");
  assert.equal(url.href, "http://127.0.0.1:4331/api/runs?limit=5");
});
