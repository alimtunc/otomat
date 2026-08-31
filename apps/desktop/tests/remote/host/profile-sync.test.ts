import {
  agentProfileReplicaSchema,
  type AgentProfileReplicaEntry,
  type ExecutionHostId,
} from "@otomat/domain";
import { expect, it } from "vitest";

import type { HostTarget } from "#main/remote/host/catalog";
import { AgentProfileSync } from "#main/remote/host/profile-sync";

const LOCAL_URL = "http://127.0.0.1:4319";
const REMOTE_URL = "http://127.0.0.1:4400";

function entry(id: string): AgentProfileReplicaEntry {
  return {
    id,
    name: id,
    runtime: "fake",
    options: {},
    model: null,
    guidance: null,
    skill_ids: [],
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
    deleted_at: null,
  };
}

/** Stands in for one daemon's `/api/agent-profiles/replica`; the merge policy itself is the daemon's own test. */
class FakeDaemon {
  private readonly held = new Map<string, AgentProfileReplicaEntry>();
  rounds = 0;

  constructor(...profiles: AgentProfileReplicaEntry[]) {
    for (const profile of profiles) this.held.set(profile.id, profile);
  }

  get ids(): string[] {
    return [...this.held.keys()].toSorted();
  }

  merge(incoming: AgentProfileReplicaEntry[]): AgentProfileReplicaEntry[] {
    this.rounds += 1;
    for (const profile of incoming) this.held.set(profile.id, profile);
    return [...this.held.values()];
  }
}

function target(id: ExecutionHostId, url: string | null): HostTarget {
  return {
    host: { id, label: id, kind: id === "local" ? "local" : "ssh" },
    active: id === "local",
    status: null,
    url,
  };
}

function sync(targets: HostTarget[], daemons: Record<string, FakeDaemon | undefined>) {
  const logs: string[] = [];
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(String(input));
    const daemon = daemons[url.origin];
    if (daemon === undefined) throw new TypeError("fetch failed");
    const body = agentProfileReplicaSchema.parse(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ profiles: daemon.merge(body.profiles) }), {
      headers: { "content-type": "application/json" },
    });
  };
  return {
    logs,
    sync: new AgentProfileSync({ targets: () => targets, fetchImpl, log: (m) => logs.push(m) }),
  };
}

it("carries each host's catalog to the other", async () => {
  const local = new FakeDaemon(entry("from-local"));
  const remote = new FakeDaemon(entry("from-remote"));
  const { sync: profiles } = sync([target("local", LOCAL_URL), target("remote", REMOTE_URL)], {
    [LOCAL_URL]: local,
    [REMOTE_URL]: remote,
  });

  await profiles.sync();

  expect(local.ids).toEqual(["from-local", "from-remote"]);
  expect(remote.ids).toEqual(["from-local", "from-remote"]);
});

it("leaves an unreachable host behind without losing what the others hold", async () => {
  const local = new FakeDaemon(entry("from-local"));
  const { logs, sync: profiles } = sync(
    [target("local", LOCAL_URL), target("remote", REMOTE_URL)],
    { [LOCAL_URL]: local },
  );

  await expect(profiles.sync()).resolves.toBeUndefined();

  expect(local.ids).toEqual(["from-local"]);
  expect(logs.join(" ")).toContain(REMOTE_URL);
});

it("leaves a host that refuses the exchange behind without losing what the others hold", async () => {
  const local = new FakeDaemon(entry("from-local"));
  const logs: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    if (new URL(String(input)).origin === REMOTE_URL) return new Response("{}", { status: 409 });
    const body = agentProfileReplicaSchema.parse(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ profiles: local.merge(body.profiles) }), {
      headers: { "content-type": "application/json" },
    });
  };
  const profiles = new AgentProfileSync({
    targets: () => [target("local", LOCAL_URL), target("remote", REMOTE_URL)],
    fetchImpl,
    log: (m) => logs.push(m),
  });

  await expect(profiles.sync()).resolves.toBeUndefined();

  expect(local.ids).toEqual(["from-local"]);
  expect(logs.join(" ")).toContain("refused");
});

it("asks nobody while a single host is reachable", async () => {
  const local = new FakeDaemon(entry("from-local"));
  const { sync: profiles } = sync([target("local", LOCAL_URL), target("remote", null)], {
    [LOCAL_URL]: local,
  });

  await profiles.sync();

  expect(local.rounds).toBe(0);
});
