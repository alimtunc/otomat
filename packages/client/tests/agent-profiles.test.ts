import { expect, it } from "vitest";

import { createDaemonClient } from "#client/client/index";

import { jsonResponse } from "./support/response.js";

interface CapturedRequest {
  url?: string;
  method?: string;
  body?: unknown;
}

const PROFILE = {
  id: "p1",
  name: "P",
  runtime: "fake",
  options: {},
  guidance: null,
  skill_ids: [],
  compatibility: null,
};

const SKILL = {
  id: "s1",
  source: "user",
  canonical_path: "/a/SKILL.md",
  name: "S",
  description: null,
  content_hash: "h",
  status: "available",
  invalid_reason: null,
  enabled: true,
};

it("creates a profile via POST and parses the response", async () => {
  let captured: CapturedRequest = {};
  const fetchMock: typeof fetch = async (input, init) => {
    captured = { url: String(input), method: init?.method, body: init?.body };
    return jsonResponse(PROFILE, 201);
  };
  const client = createDaemonClient({ baseUrl: "http://x", fetch: fetchMock });
  const profile = await client.createAgentProfile({ name: "P", runtime: "fake" });
  expect(captured.url).toBe("http://x/api/agent-profiles");
  expect(captured.method).toBe("POST");
  expect(profile.id).toBe("p1");
});

it("updates via PATCH and deletes via DELETE", async () => {
  const calls: { method?: string; url: string }[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method });
    const isDelete = init?.method === "DELETE";
    return jsonResponse(isDelete ? null : PROFILE, isDelete ? 204 : 200);
  };
  const client = createDaemonClient({ baseUrl: "http://x", fetch: fetchMock });
  await client.updateAgentProfile("p1", { name: "Q", runtime: "fake" });
  await client.deleteAgentProfile("p1");
  expect(calls[0]).toMatchObject({ method: "PATCH", url: "http://x/api/agent-profiles/p1" });
  expect(calls[1]).toMatchObject({ method: "DELETE", url: "http://x/api/agent-profiles/p1" });
});

const REPLICA_ENTRY = {
  id: "p1",
  name: "P",
  runtime: "fake",
  options: {},
  model: null,
  guidance: null,
  skill_ids: [],
  created_at: "2026-01-01 10:00:00",
  updated_at: "2026-01-01 10:00:00",
  deleted_at: null,
};

it("exchanges a replica catalog and answers with the converged one", async () => {
  let captured: CapturedRequest = {};
  const fetchMock: typeof fetch = async (input, init) => {
    captured = { url: String(input), method: init?.method, body: init?.body };
    return jsonResponse({ profiles: [REPLICA_ENTRY] });
  };
  const client = createDaemonClient({ baseUrl: "http://x", fetch: fetchMock });
  const converged = await client.mergeAgentProfileReplica([]);
  expect(captured.url).toBe("http://x/api/agent-profiles/replica");
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ profiles: [] });
  expect(converged).toEqual([REPLICA_ENTRY]);
});

it("refuses a replica answer that is not a catalog rather than merging it", async () => {
  const client = createDaemonClient({
    fetch: async () => jsonResponse({ profiles: [{ id: REPLICA_ENTRY.id }] }),
  });
  await expect(client.mergeAgentProfileReplica([])).rejects.toThrow();
});

it("scans skills via POST and lists them via GET", async () => {
  const fetchMock: typeof fetch = async () => jsonResponse([SKILL]);
  const client = createDaemonClient({ fetch: fetchMock });
  expect(await client.listSkills()).toHaveLength(1);
  expect(await client.scanSkills()).toHaveLength(1);
});
