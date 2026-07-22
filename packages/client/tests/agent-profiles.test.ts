import { expect, it } from "vitest";

import { createDaemonClient } from "#client/client/index";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const PROFILE = {
  id: "p1",
  name: "P",
  runtime: "fake",
  options: {},
  guidance: null,
  skill_ids: [],
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
  let captured: { url?: string; method?: string; body?: unknown } = {};
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

it("scans skills via POST and lists them via GET", async () => {
  const fetchMock: typeof fetch = async () => jsonResponse([SKILL]);
  const client = createDaemonClient({ fetch: fetchMock });
  expect(await client.listSkills()).toHaveLength(1);
  expect(await client.scanSkills()).toHaveLength(1);
});
