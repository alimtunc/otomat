// @vitest-environment happy-dom
import { daemon } from "@web/api/client";
import { activeHostStore } from "@web/lib/active-host";
import { afterEach, expect, it, vi } from "vitest";

import { agentProfile } from "#support/agent";

const requests: { url: string; method: string }[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
  activeHostStore.setState(() => null);
});

function captureFetch(): void {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    return Promise.resolve(
      new Response(JSON.stringify(agentProfile()), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
  });
}

it("sends a write to the host on screen and to no other, before and after a switch", async () => {
  captureFetch();
  activeHostStore.setState(() => ({ id: "local", daemonUrl: "http://127.0.0.1:5000" }));
  await daemon.createAgentProfile({ name: "P", runtime: "fake" });

  activeHostStore.setState(() => ({ id: "remote", daemonUrl: "http://127.0.0.1:45010" }));
  await daemon.createAgentProfile({ name: "Q", runtime: "fake" });

  expect(requests).toEqual([
    { url: "http://127.0.0.1:5000/api/agent-profiles", method: "POST" },
    { url: "http://127.0.0.1:45010/api/agent-profiles", method: "POST" },
  ]);
});
