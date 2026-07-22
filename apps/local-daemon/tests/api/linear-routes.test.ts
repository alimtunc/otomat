import {
  issueSourceContractSchema,
  linearConnectionContractSchema,
  linearIssueDraftSchema,
  type LinearIssueSnapshot,
  syncLinearResponseSchema,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { linearError, LinearWriteConflictError } from "#linear";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { connectedLinear, stubLinearService } from "../support/linear.js";

const KEY = "lin_api_secret";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-linear-api-");
});

afterEach(() => {
  vi.restoreAllMocks();
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

it("leaves unexpected failures to the central API error handler", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const app = makeApiApp(t, {
    linear: stubLinearService({
      workspace: async () => {
        throw new Error("unexpected failure");
      },
    }),
  });

  const response = await request(app, "/api/linear/workspace");

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "internal_error" });
  expect(log).toHaveBeenCalledOnce();
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
      createSource: async () => {
        throw linearError("linear_source_already_mapped");
      },
    }),
  });

  expect((await post(missing, "/api/linear/sync", { source_id: "nope" })).status).toBe(404);
  const conflict = await post(duplicate, "/api/linear/sources", {
    project_id: "p1",
    external_team_id: "team-1",
  });
  expect(conflict.status).toBe(409);
});

it("serves mapped sources and sync results through their contracts", async () => {
  const source = {
    id: "src-1",
    project_id: "p1",
    source: "linear" as const,
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

const REMOTE_SNAPSHOT: LinearIssueSnapshot = {
  title: "Changed remotely",
  description: "Body",
  priority: 2,
  assignee_id: "u1",
  label_ids: ["lab1"],
  external_id: "L-1",
  identifier: "OTO-99",
  url: "https://linear.app/otomat/issue/OTO-99",
  updated_at: "2026-07-21T09:00:00.000Z",
  assignee: { id: "u1", name: "Alim" },
  labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
  state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
};

it("returns the remote snapshot when a fields publish conflicts", async () => {
  const app = makeApiApp(t, {
    linear: stubLinearService({
      writeback: {
        publishFields: async () => {
          throw new LinearWriteConflictError(REMOTE_SNAPSHOT);
        },
      },
    }),
  });

  const res = await post(app, "/api/linear/issues/li/publish-fields", { overwrite: false });

  expect(res.status).toBe(409);
  const body = (await res.json()) as { error: string; remote: LinearIssueSnapshot };
  expect(body.error).toBe("linear_write_conflict");
  expect(body.remote.title).toBe("Changed remotely");
});

it("maps a non-writable issue to 400 and a missing issue to 404", async () => {
  const notWritable = makeApiApp(t, {
    linear: stubLinearService({
      writeback: {
        editorState: async () => {
          throw linearError("linear_issue_not_writable");
        },
      },
    }),
  });
  const missing = makeApiApp(t, {
    linear: stubLinearService({
      writeback: {
        publishStatus: async () => {
          throw linearError("linear_issue_not_found");
        },
      },
    }),
  });

  expect((await request(notWritable, "/api/linear/issues/li/editor")).status).toBe(400);
  expect(
    (await post(missing, "/api/linear/issues/li/publish-status", { state_id: "s-done" })).status,
  ).toBe(404);
});

it("saves a draft and returns it through its contract", async () => {
  const draft = {
    id: "draft-1",
    issue_id: "li",
    base_updated_at: "2026-07-20T10:00:00.000Z",
    title: "My edit",
    description: "Body",
    priority: 2,
    assignee_id: "u1",
    label_ids: ["lab1"],
    updated_at: "2026-07-21T12:00:00.000Z",
  };
  const app = makeApiApp(t, {
    linear: stubLinearService({ writeback: { saveDraft: () => draft } }),
  });

  const res = await post(app, "/api/linear/issues/li/draft", {
    base_updated_at: draft.base_updated_at,
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    assignee_id: draft.assignee_id,
    label_ids: draft.label_ids,
  });

  expect(res.status).toBe(200);
  expect(linearIssueDraftSchema.parse(await res.json()).title).toBe("My edit");
});

it("rejects a draft body missing the base revision", async () => {
  const app = makeApiApp(t, { linear: stubLinearService() });

  const res = await post(app, "/api/linear/issues/li/draft", {
    title: "x",
    description: null,
    priority: 0,
    assignee_id: null,
    label_ids: [],
  });

  expect(res.status).toBe(400);
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
