import {
  issueSourceContractSchema,
  linearConnectionContractSchema,
  syncLinearResponseSchema,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { linearError } from "#linear";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { connectedLinear, stubLinearService } from "../support/linear.js";

const KEY = "lin_api_secret";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-linear-api-");
});

afterEach(() => {
  t.cleanup();
});

it("accepts a key and answers with a connection that never contains it", async () => {
  const submitted: string[] = [];
  const app = makeApiApp(t, {
    linear: stubLinearService({
      connect: async (apiKey) => {
        submitted.push(apiKey);
        return connectedLinear();
      },
    }),
  });

  const res = await post(app, "/api/linear/connect", { api_key: KEY });

  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).not.toContain(KEY);
  expect(linearConnectionContractSchema.parse(JSON.parse(body)).status).toBe("connected");
  expect(submitted).toEqual([KEY]);
});

it("never echoes a key from the connection endpoint", async () => {
  const app = makeApiApp(t, {
    linear: stubLinearService({ connection: () => connectedLinear() }),
  });

  const res = await request(app, "/api/linear/connection");

  expect(res.status).toBe(200);
  expect(await res.text()).not.toContain(KEY);
});

it("rejects a connect body that is not exactly a key", async () => {
  const app = makeApiApp(t, {
    linear: stubLinearService({
      connect: async () => {
        throw new Error("connect must not run");
      },
    }),
  });

  expect((await post(app, "/api/linear/connect", {})).status).toBe(400);
  expect((await post(app, "/api/linear/connect", { api_key: "" })).status).toBe(400);
  const extra = await post(app, "/api/linear/connect", { api_key: KEY, persist: true });
  expect(extra.status).toBe(400);
  expect(await extra.json()).toMatchObject({ error: "invalid_request" });
});

it("maps a missing connection to 409 with a stable code", async () => {
  const app = makeApiApp(t, {
    linear: stubLinearService({
      sync: async () => {
        throw linearError("linear_not_connected");
      },
    }),
  });

  const res = await post(app, "/api/linear/sync", {});

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "linear_not_connected",
    message: "Connect a Linear workspace first.",
  });
});

it("maps a rate limit to 409 and an outage to 503", async () => {
  const rateLimited = makeApiApp(t, {
    linear: stubLinearService({
      sync: async () => {
        throw linearError("linear_rate_limited");
      },
    }),
  });
  const offline = makeApiApp(t, {
    linear: stubLinearService({
      workspace: async () => {
        throw linearError("linear_unavailable");
      },
    }),
  });

  expect((await post(rateLimited, "/api/linear/sync", {})).status).toBe(409);
  expect((await request(offline, "/api/linear/workspace")).status).toBe(503);
});

it("maps an unknown source to 404 and a duplicate mapping to 409", async () => {
  const missing = makeApiApp(t, {
    linear: stubLinearService({
      sync: async () => {
        throw linearError("linear_source_not_found");
      },
    }),
  });
  const duplicate = makeApiApp(t, {
    linear: stubLinearService({
      createSource: () => {
        throw linearError("linear_source_already_mapped");
      },
    }),
  });

  expect((await post(missing, "/api/linear/sync", { source_id: "nope" })).status).toBe(404);
  const conflict = await post(duplicate, "/api/linear/sources", {
    project_id: "p1",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
  });
  expect(conflict.status).toBe(409);
});

it("serves mapped sources and sync results through their contracts", async () => {
  const source = {
    id: "src-1",
    source: "linear" as const,
    project_id: "p1",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    external_project_id: "",
    external_project_name: "",
    last_synced_at: null,
  };
  const app = makeApiApp(t, {
    linear: stubLinearService({
      sources: () => [source],
      sync: async () => [
        { source_id: "src-1", imported: 2, updated: 1, synced_at: "2026-07-20T12:00:00.000Z" },
      ],
    }),
  });

  const listed = await request(app, "/api/linear/sources");
  expect(issueSourceContractSchema.array().parse(await listed.json())).toEqual([source]);

  const synced = await post(app, "/api/linear/sync", {});
  expect(syncLinearResponseSchema.parse(await synced.json()).results[0]).toMatchObject({
    imported: 2,
    updated: 1,
  });
});

it("keeps the Linear routes behind the loopback host guard", async () => {
  const app = makeApiApp(t, {
    linear: stubLinearService({
      connect: async () => {
        throw new Error("connect must not run");
      },
    }),
  });

  const res = await app.request("/api/linear/connect", {
    method: "POST",
    headers: { Host: "evil.example.com", "content-type": "application/json" },
    body: JSON.stringify({ api_key: KEY }),
  });

  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "forbidden_host" });
});
