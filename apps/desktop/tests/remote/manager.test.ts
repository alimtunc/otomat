import { mkdirSync, rmSync } from "node:fs";

import type { RemoteHostStatus } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import {
  executionHostsConfigPath,
  readExecutionHostsConfig,
  writeExecutionHostsConfig,
} from "#main/remote/host/config";
import { ExecutionHostManager } from "#main/remote/manager";
import type { RemoteSessionHandle } from "#main/remote/session";
import { scratchDir } from "#support/scratch-dir";

const CONNECTED: RemoteHostStatus = { phase: "connected", detail: null };

class FakeSession implements RemoteSessionHandle {
  status: RemoteHostStatus = { phase: "disconnected", detail: null };
  url: string | null = null;
  remoteBuild: string | null = null;
  disposeCount = 0;
  refreshCount = 0;
  lastRetryFlag: boolean | null = null;
  constructor(
    readonly alias: string,
    private readonly connectResult: RemoteHostStatus,
    private readonly onStatus: (status: RemoteHostStatus) => void = () => {},
  ) {}
  ensureLocalPort(): Promise<number> {
    this.url = "http://127.0.0.1:45010";
    return Promise.resolve(45_010);
  }
  connect(retryOnFailure: boolean): Promise<RemoteHostStatus> {
    this.lastRetryFlag = retryOnFailure;
    this.status = this.connectResult;
    if (this.connectResult.phase === "connected") {
      this.url = "http://127.0.0.1:45010";
      this.remoteBuild = "fff9999";
    }
    this.onStatus(this.status);
    return Promise.resolve(this.status);
  }
  refreshDaemon(): Promise<RemoteHostStatus> {
    this.refreshCount += 1;
    return this.connect(false);
  }
  dispose(): Promise<void> {
    this.disposeCount += 1;
    this.status = { phase: "disconnected", detail: null };
    return Promise.resolve();
  }
}

function scratch(): string {
  return scratchDir("otomat-hosts-manager-");
}

function makeManager(options?: {
  dataDir?: string;
  connectResult?: RemoteHostStatus;
  localUrl?: string;
  expectedBuild?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const dataDir = options?.dataDir ?? scratch();
  const applied: string[] = [];
  const sessions: FakeSession[] = [];
  const connected: Array<{ alias: string; url: string }> = [];
  const manager = new ExecutionHostManager({
    dataDir,
    log: () => {},
    localDaemonUrl: () => options?.localUrl ?? "http://127.0.0.1:49152",
    onRemoteStatus: () => {},
    onRemoteConnected: (alias, url) => connected.push({ alias, url }),
    applyRendererUrl: (url) => applied.push(url),
    expectedBuild: options?.expectedBuild ?? null,
    repo: "alimtunc/otomat",
    createSession: (sessionOptions) => {
      const session = new FakeSession(
        sessionOptions.alias,
        options?.connectResult ?? CONNECTED,
        sessionOptions.onStatus,
      );
      sessions.push(session);
      return session;
    },
    listAliases: () => ["otomat-vps"],
    fetchImpl: options?.fetchImpl,
  });
  return { manager, applied, sessions, connected, dataDir };
}

function projectsResponse(projects: unknown): Response {
  // SAFETY: the manager reads only ok and json from a catalog response.
  return { ok: true, json: async () => projects } as Response;
}

it("refuses to select the remote host before an alias is configured", async () => {
  const { manager, applied } = makeManager();
  const result = await manager.select("remote");
  expect(result).toEqual({
    ok: false,
    status: { phase: "error", code: "not_configured", detail: null },
  });
  expect(applied).toEqual([]);
});

it.each(["", "  ", "two words", "-oProxyCommand=evil"])("rejects the alias %j", (alias) => {
  const { manager } = makeManager();
  expect(manager.configureRemote(alias).ok).toBe(false);
});

it("refuses an alias change while a host switch is in flight", async () => {
  let release!: (status: RemoteHostStatus) => void;
  const manager = new ExecutionHostManager({
    dataDir: scratch(),
    log: () => {},
    localDaemonUrl: () => "http://127.0.0.1:49152",
    onRemoteStatus: () => {},
    applyRendererUrl: () => {},
    expectedBuild: null,
    repo: "alimtunc/otomat",
    createSession: (sessionOptions) => {
      const session = new FakeSession(sessionOptions.alias, CONNECTED);
      session.connect = () =>
        new Promise((resolve) => {
          release = (status) => {
            session.status = status;
            session.url = "http://127.0.0.1:45010";
            resolve(status);
          };
        });
      return session;
    },
    listAliases: () => ["otomat-vps"],
  });
  expect(manager.configureRemote("otomat-vps").ok).toBe(true);

  const pending = manager.select("remote");
  const blocked = manager.configureRemote("other-host");
  expect(blocked.ok).toBe(false);

  release(CONNECTED);
  await expect(pending).resolves.toEqual({ ok: true });
  expect(manager.remoteSshAlias).toBe("otomat-vps");
});

it("removes the remote host: session disposed, alias cleared, server untouched", async () => {
  const { manager, sessions, dataDir } = makeManager();
  manager.configureRemote("otomat-vps");

  const result = manager.removeRemote();

  expect(result).toEqual({ ok: true });
  expect(manager.remoteSshAlias).toBeNull();
  expect(sessions[0]?.disposeCount).toBe(1);
  expect(sessions[0]?.refreshCount).toBe(0);
  expect(readExecutionHostsConfig(dataDir)).toEqual({
    version: 1,
    remote: null,
    active: "local",
  });
  expect(await manager.catalog.listProjects()).toHaveLength(1);
});

it("keeps the previous selection in force when the config cannot be persisted", async () => {
  const dataDir = scratch();
  const { manager, applied, sessions } = makeManager({ dataDir });
  expect(manager.configureRemote("otomat-vps").ok).toBe(true);
  // A directory at the config path makes every later write fail.
  rmSync(executionHostsConfigPath(dataDir));
  mkdirSync(executionHostsConfigPath(dataDir));

  const selected = await manager.select("remote");
  expect(selected.ok).toBe(false);
  expect(selected).toMatchObject({ message: expect.stringContaining("saved") });
  expect(manager.activeHostId).toBe("local");
  expect(applied).toEqual([]);

  const removed = manager.removeRemote();
  expect(removed.ok).toBe(false);
  expect(manager.snapshot().remote_ssh_alias).toBe("otomat-vps");
  expect(sessions[0]?.disposeCount).toBe(0);
});

it("does not confirm an alias the disk never recorded", () => {
  const dataDir = scratch();
  mkdirSync(executionHostsConfigPath(dataDir));
  const { manager } = makeManager({ dataDir });

  const result = manager.configureRemote("otomat-vps");

  expect(result.ok).toBe(false);
  expect(manager.snapshot().remote_ssh_alias).toBeNull();
});

it("refuses to remove the host while a remote project is active", async () => {
  const { manager } = makeManager();
  manager.configureRemote("otomat-vps");
  await manager.select("remote");

  const result = manager.removeRemote();

  expect(result).toMatchObject({ ok: false });
  expect(manager.remoteSshAlias).toBe("otomat-vps");
  expect(manager.activeHostId).toBe("remote");
});

it("registers a project on the local daemon and returns the created project", async () => {
  const project = { id: "p-new", name: "app", root_path: "/repos/app", has_repository: true };
  // SAFETY: the manager reads only status, ok and json from a registration response.
  const fetchImpl = vi.fn(
    async () =>
      ({
        status: 201,
        ok: true,
        json: async () => ({
          project,
          repository: {
            id: "r-new",
            project_id: "p-new",
            name: "app",
            remote_url: null,
            default_branch: "main",
            init_commands: [],
            available: true,
          },
        }),
      }) as Response,
  );
  const { manager } = makeManager({ fetchImpl });

  const result = await manager.catalog.registerProject("local", "/repos/app");

  expect(result).toEqual({ ok: true, project });
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:49152/api/repositories",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ path: "/repos/app" }) }),
  );
});

it("registers on the remote daemon through the tunnel once connected, and refuses before", async () => {
  // SAFETY: the manager reads only status, ok and json from a registration response.
  const fetchImpl = vi.fn(
    async () =>
      ({
        status: 201,
        ok: true,
        json: async () => ({
          project: { id: "p-vps", name: "vps-app", root_path: "/srv/app", has_repository: true },
          repository: {
            id: "r-vps",
            project_id: "p-vps",
            name: "vps-app",
            remote_url: null,
            default_branch: "main",
            init_commands: [],
            available: true,
          },
        }),
      }) as Response,
  );
  const { manager, sessions } = makeManager({ fetchImpl });

  const unconfigured = await manager.catalog.registerProject("remote", "/srv/app");
  expect(unconfigured).toMatchObject({ ok: false });

  manager.configureRemote("otomat-vps");
  await manager.select("remote");
  await manager.select("local");
  expect(sessions[0]?.status.phase).toBe("connected");

  const result = await manager.catalog.registerProject("remote", "/srv/app");
  expect(result).toMatchObject({ ok: true, project: { id: "p-vps" } });
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:45010/api/repositories",
    expect.objectContaining({ method: "POST" }),
  );
});

it("names an unreadable 201 body instead of blaming connectivity", async () => {
  // SAFETY: the manager reads only status, ok and json from a registration response.
  const fetchImpl = vi.fn(
    async () =>
      ({
        status: 201,
        ok: true,
        json: async () => ({ project: { id: "p-new" } }),
      }) as Response,
  );
  const { manager } = makeManager({ fetchImpl });

  const result = await manager.catalog.registerProject("local", "/repos/app");

  expect(result).toMatchObject({
    ok: false,
    message: expect.stringContaining("unknown format"),
  });
});

it("re-arms a session settled on error at the next background warm-up", async () => {
  const { manager, sessions } = makeManager({
    connectResult: { phase: "error", code: "ssh_unreachable", detail: null },
  });
  manager.configureRemote("otomat-vps");
  const session = sessions[0];
  expect(session?.status.phase).toBe("error");

  const failed = await manager.select("remote");
  expect(failed).toMatchObject({ ok: false });
  expect(session?.lastRetryFlag).toBe(false);

  await manager.catalog.listProjects();

  expect(session?.lastRetryFlag).toBe(true);
  expect(sessions).toHaveLength(1);
});

it("surfaces the daemon's registration refusal verbatim", async () => {
  // SAFETY: the manager reads only status, ok and json from a registration response.
  const fetchImpl = vi.fn(
    async () =>
      ({
        status: 400,
        ok: false,
        headers: new Headers(),
        json: async () => ({ error: "path_not_git_repository", message: "Not a git repository." }),
      }) as Response,
  );
  const { manager } = makeManager({ fetchImpl });

  const result = await manager.catalog.registerProject("local", "/tmp/not-a-repo");

  expect(result).toEqual({ ok: false, message: "Not a git repository." });
});

it("connects, persists the selection, and re-points the renderer on success", async () => {
  const { manager, applied, sessions, dataDir } = makeManager();
  expect(manager.configureRemote("otomat-vps")).toEqual({ ok: true });
  const result = await manager.select("remote");
  expect(result).toEqual({ ok: true });
  expect(applied).toEqual(["http://127.0.0.1:45010"]);
  expect(sessions[0]?.lastRetryFlag).toBe(false);
  expect(readExecutionHostsConfig(dataDir)).toEqual({
    version: 1,
    remote: { ssh_alias: "otomat-vps" },
    active: "remote",
  });
});

it("announces a connected session with its tunnel origin, and never a failed one", async () => {
  const { manager, connected } = makeManager();
  manager.configureRemote("otomat-vps");
  await manager.select("remote");
  // Every announcement carries this host's own tunnel origin; the sandbox de-duplicates them.
  expect(connected[0]).toEqual({ alias: "otomat-vps", url: "http://127.0.0.1:45010" });

  const failed = makeManager({
    connectResult: { phase: "error", code: "ssh_unreachable", detail: "no route" },
  });
  failed.manager.configureRemote("otomat-vps");
  await failed.manager.select("remote");
  expect(failed.connected).toEqual([]);
});

it("keeps the local selection and never re-points the renderer when the remote connect fails", async () => {
  const { manager, applied, dataDir } = makeManager({
    connectResult: { phase: "error", code: "ssh_unreachable", detail: "no route" },
  });
  manager.configureRemote("otomat-vps");
  const result = await manager.select("remote");
  expect(result).toEqual({
    ok: false,
    status: { phase: "error", code: "ssh_unreachable", detail: "no route" },
  });
  expect(applied).toEqual([]);
  expect(manager.activeHostId).toBe("local");
  expect(readExecutionHostsConfig(dataDir).active).toBe("local");
});

it("refuses to switch to a local daemon that is not running", async () => {
  const { manager, applied } = makeManager({ localUrl: "" });
  const result = await manager.select("local");
  expect(result).toEqual({
    ok: false,
    status: { phase: "error", code: "local_daemon_unavailable", detail: null },
  });
  expect(applied).toEqual([]);
});

it("switching back to local keeps the tunnel alive for the aggregated switcher", async () => {
  const { manager, applied, sessions, dataDir } = makeManager();
  manager.configureRemote("otomat-vps");
  await manager.select("remote");
  const result = await manager.select("local");
  expect(result).toEqual({ ok: true });
  expect(sessions[0]?.disposeCount).toBe(0);
  expect(sessions[0]?.status.phase).toBe("connected");
  expect(applied.at(-1)).toBe("http://127.0.0.1:49152");
  expect(readExecutionHostsConfig(dataDir).active).toBe("local");
});

it("boot-activates a persisted remote selection with a stable URL and background retry", async () => {
  const dataDir = scratch();
  writeExecutionHostsConfig(dataDir, {
    version: 1,
    remote: { ssh_alias: "otomat-vps" },
    active: "remote",
  });
  const { manager, sessions } = makeManager({ dataDir });
  const url = await manager.bootActivate();
  expect(url).toBe("http://127.0.0.1:45010");
  expect(sessions[0]?.lastRetryFlag).toBe(true);
});

it("stays on local at boot when nothing was persisted", async () => {
  const { manager, sessions } = makeManager();
  expect(await manager.bootActivate()).toBeNull();
  expect(sessions).toHaveLength(0);
  expect(manager.activeHostId).toBe("local");
});

it("blocks changing the alias while the remote host is active", async () => {
  const { manager } = makeManager();
  manager.configureRemote("otomat-vps");
  await manager.select("remote");
  const result = manager.configureRemote("other-host");
  expect(result).toEqual({
    ok: false,
    message: expect.stringContaining("Switch to a local project"),
  });
});

it("surfaces the remote daemon's build next to the app's expected build", async () => {
  const { manager } = makeManager({ expectedBuild: "abc1234" });
  manager.configureRemote("otomat-vps");
  await manager.select("remote");

  const snapshot = manager.snapshot();
  expect(snapshot.expected_build).toBe("abc1234");
  expect(snapshot.remote_build).toBe("fff9999");
});

it("warms the remote tunnel at boot even when a local project is active", async () => {
  const dataDir = scratch();
  writeExecutionHostsConfig(dataDir, {
    version: 1,
    remote: { ssh_alias: "otomat-vps" },
    active: "local",
  });
  const { manager, sessions } = makeManager({ dataDir });
  expect(await manager.bootActivate()).toBeNull();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.lastRetryFlag).toBe(true);
  expect(manager.activeHostId).toBe("local");
});

it("aggregates both hosts' project catalogs for the switcher", async () => {
  const fetched: string[] = [];
  const { manager } = makeManager({
    fetchImpl: async (input) => {
      const url = String(input);
      fetched.push(url);
      return projectsResponse([
        {
          id: "local-default",
          name: url.includes("49152") ? "Local workspace" : "VPS workspace",
          root_path: url.includes("49152") ? "/home/dev/repo" : "/root/repos/scratch",
        },
      ]);
    },
  });
  manager.configureRemote("otomat-vps");

  const entries = await manager.catalog.listProjects();

  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({
    host: { id: "local", kind: "local" },
    active: true,
    projects: [{ id: "local-default", name: "Local workspace" }],
  });
  expect(entries[1]).toMatchObject({
    host: { id: "remote", label: "otomat-vps", kind: "ssh" },
    active: false,
    status: { phase: "connected" },
    projects: [{ id: "local-default", name: "VPS workspace" }],
  });
  expect(fetched.some((url) => url.includes("45010"))).toBe(true);
});

it("reports an unreachable remote host as projects: null, never an error", async () => {
  const { manager } = makeManager({
    connectResult: { phase: "error", code: "ssh_unreachable", detail: "no route" },
    fetchImpl: async () => projectsResponse([]),
  });
  manager.configureRemote("otomat-vps");

  const entries = await manager.catalog.listProjects();

  expect(entries[1]).toMatchObject({
    host: { id: "remote" },
    projects: null,
    status: { phase: "error", code: "ssh_unreachable" },
  });
});

it("speaks for the host with the update journey, holding it until the runs in flight finish", async () => {
  const { manager, sessions } = makeManager({
    expectedBuild: "abc1234",
    fetchImpl: async (input) =>
      projectsResponse(
        String(input).endsWith("/api/runs")
          ? [{ status: "running" }]
          : [{ id: "p", name: "P", root_path: "/tmp/p" }],
      ),
  });
  manager.configureRemote("otomat-vps");

  await vi.waitFor(() =>
    expect(manager.snapshot().remote_status).toEqual({
      phase: "waiting_for_runs",
      active_runs: 1,
      detail: null,
    }),
  );
  // The session is connected underneath: nothing was stopped, and the tunnel still serves the cockpit.
  expect(sessions[0]?.status.phase).toBe("connected");
  expect(sessions[0]?.refreshCount).toBe(0);

  // A catalog read is pure: it warms the healthy session but never drives the update.
  await manager.catalog.listProjects();
  expect(sessions[0]?.refreshCount).toBe(0);
  await manager.shutdown();
});
