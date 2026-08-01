import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RemoteHostStatus } from "@otomat/domain";
import { afterEach, expect, it } from "vitest";

import { readExecutionHostsConfig, writeExecutionHostsConfig } from "#main/remote/hosts-config";
import { ExecutionHostManager } from "#main/remote/manager";
import type { RemoteSessionHandle } from "#main/remote/session";

const CONNECTED: RemoteHostStatus = { phase: "connected", detail: null };

class FakeSession implements RemoteSessionHandle {
  status: RemoteHostStatus = { phase: "disconnected", detail: null };
  url: string | null = null;
  disposeCount = 0;
  lastRetryFlag: boolean | null = null;
  constructor(
    readonly alias: string,
    private readonly connectResult: RemoteHostStatus,
  ) {}
  ensureLocalPort(): Promise<number> {
    this.url = "http://127.0.0.1:45010";
    return Promise.resolve(45_010);
  }
  connect(retryOnFailure: boolean): Promise<RemoteHostStatus> {
    this.lastRetryFlag = retryOnFailure;
    this.status = this.connectResult;
    if (this.connectResult.phase === "connected") this.url = "http://127.0.0.1:45010";
    return Promise.resolve(this.status);
  }
  dispose(): Promise<void> {
    this.disposeCount += 1;
    this.status = { phase: "disconnected", detail: null };
    return Promise.resolve();
  }
}

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-hosts-manager-"));
  scratchDirs.push(dir);
  return dir;
}

function makeManager(options?: {
  dataDir?: string;
  connectResult?: RemoteHostStatus;
  localUrl?: string;
}) {
  const dataDir = options?.dataDir ?? scratch();
  const applied: string[] = [];
  const sessions: FakeSession[] = [];
  const manager = new ExecutionHostManager({
    dataDir,
    log: () => {},
    localDaemonUrl: () => options?.localUrl ?? "http://127.0.0.1:49152",
    onRemoteStatus: () => {},
    applyRendererUrl: (url) => applied.push(url),
    createSession: (sessionOptions) => {
      const session = new FakeSession(sessionOptions.alias, options?.connectResult ?? CONNECTED);
      sessions.push(session);
      return session;
    },
    listAliases: () => ["otomat-vps"],
  });
  return { manager, applied, sessions, dataDir };
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("refuses to select the remote host before an alias is configured", async () => {
  const { manager, applied } = makeManager();
  const result = await manager.select("remote");
  expect(result).toEqual({ ok: false, message: expect.stringContaining("Configure") });
  expect(applied).toEqual([]);
});

it.each(["", "  ", "two words", "-oProxyCommand=evil"])("rejects the alias %j", (alias) => {
  const { manager } = makeManager();
  expect(manager.configureRemote(alias).ok).toBe(false);
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

it("keeps the local selection and never re-points the renderer when the remote connect fails", async () => {
  const { manager, applied, dataDir } = makeManager({
    connectResult: { phase: "error", code: "ssh_unreachable", detail: "no route" },
  });
  manager.configureRemote("otomat-vps");
  const result = await manager.select("remote");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("Could not reach the host over SSH");
  expect(applied).toEqual([]);
  expect(manager.activeHostId).toBe("local");
  expect(readExecutionHostsConfig(dataDir).active).toBe("local");
});

it("refuses to switch to a local daemon that is not running", async () => {
  const { manager, applied } = makeManager({ localUrl: "" });
  const result = await manager.select("local");
  expect(result).toEqual({ ok: false, message: expect.stringContaining("local daemon") });
  expect(applied).toEqual([]);
});

it("switching back to local disposes the tunnel session but persists the choice", async () => {
  const { manager, applied, sessions, dataDir } = makeManager();
  manager.configureRemote("otomat-vps");
  await manager.select("remote");
  const result = await manager.select("local");
  expect(result).toEqual({ ok: true });
  expect(sessions[0]?.disposeCount).toBe(1);
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
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("Switch to the local host");
});
