import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedDataDirectory } from "#main/data-safety/index";
import { PreviewSandbox, type SandboxDaemon } from "#main/preview/sandbox";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));
const HOME_SUFFIX = ".otomat/instances/92584b0";

const scratchDirs: string[] = [];

function layout(): ManagedDataDirectory {
  const root = mkdtempSync(join(tmpdir(), "otomat-sandbox-data-"));
  scratchDirs.push(root);
  return {
    root,
    dbPath: join(root, "otomat.db"),
    backupsDir: join(root, "backups"),
    logsDir: join(root, "logs"),
    manifestPath: join(root, "data-layout.json"),
  };
}

function okFetch(recordRegistration?: (body: string) => void): typeof fetch {
  return ((input: unknown, init?: RequestInit) => {
    if (String(input).endsWith("/api/repositories")) {
      recordRegistration?.(String(init?.body));
      return Promise.resolve(
        new Response(JSON.stringify({ project: { id: "p-1" } }), { status: 201 }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ id: "i" }), { status: 201 }));
  }) as typeof fetch;
}

function fakeDaemon(): SandboxDaemon & { stop: ReturnType<typeof vi.fn> } {
  return {
    running: true,
    stop: vi.fn(() => Promise.resolve()),
    start: vi.fn(() => Promise.resolve("http://127.0.0.1:43999")),
  };
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PreviewSandbox", () => {
  it("refuses everything outside preview builds", async () => {
    const directory = layout();
    const daemon = fakeDaemon();
    const sandbox = new PreviewSandbox({
      enabled: false,
      dataDirectory: directory,
      templateDir: TEMPLATE_DIR,
      remoteHomeSuffix: HOME_SUFFIX,
      daemon,
      onDaemonStarted: vi.fn(),
      log: () => {},
      fetchImpl: (() => {
        throw new Error("fetch must not run outside previews");
      }) as unknown as typeof fetch,
    });

    await sandbox.ensure("http://127.0.0.1:4319");
    const result = await sandbox.reset();

    expect(result.ok).toBe(false);
    expect(daemon.stop).not.toHaveBeenCalled();
    expect(existsSync(join(directory.root, "test-repo"))).toBe(false);
  });

  it("degrades a boot-time seeding failure to a log line", async () => {
    const log = vi.fn();
    const sandbox = new PreviewSandbox({
      enabled: true,
      dataDirectory: layout(),
      templateDir: TEMPLATE_DIR,
      remoteHomeSuffix: HOME_SUFFIX,
      daemon: fakeDaemon(),
      onDaemonStarted: vi.fn(),
      log,
      fetchImpl: (() =>
        Promise.resolve(new Response("boom", { status: 500 }))) as unknown as typeof fetch,
    });

    await expect(sandbox.ensure("http://127.0.0.1:4319")).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Preview sandbox setup failed/));
  });

  it("reset wipes the test state, restarts, reseeds and re-points the renderer", async () => {
    const directory = layout();
    writeFileSync(directory.dbPath, "db");
    mkdirSync(join(directory.root, "runs"));
    mkdirSync(join(directory.root, "worktrees"));
    const daemon = fakeDaemon();
    const onDaemonStarted = vi.fn();
    const sandbox = new PreviewSandbox({
      enabled: true,
      dataDirectory: directory,
      templateDir: TEMPLATE_DIR,
      remoteHomeSuffix: HOME_SUFFIX,
      daemon,
      onDaemonStarted,
      log: () => {},
      fetchImpl: okFetch(),
    });

    const result = await sandbox.reset();

    expect(result).toEqual({ ok: true, message: null });
    expect(daemon.stop).toHaveBeenCalledOnce();
    expect(existsSync(directory.dbPath)).toBe(false);
    expect(existsSync(join(directory.root, "runs"))).toBe(false);
    expect(existsSync(join(directory.root, "worktrees"))).toBe(false);
    expect(existsSync(join(directory.root, "test-repo", ".git"))).toBe(true);
    expect(onDaemonStarted).toHaveBeenCalledWith("http://127.0.0.1:43999");
  });

  it("still re-points the renderer when reseeding fails after the restart", async () => {
    const onDaemonStarted = vi.fn();
    const sandbox = new PreviewSandbox({
      enabled: true,
      dataDirectory: layout(),
      templateDir: TEMPLATE_DIR,
      remoteHomeSuffix: HOME_SUFFIX,
      daemon: fakeDaemon(),
      onDaemonStarted,
      log: () => {},
      fetchImpl: (() =>
        Promise.resolve(new Response("boom", { status: 500 }))) as unknown as typeof fetch,
    });

    const result = await sandbox.reset();

    expect(result.ok).toBe(false);
    expect(onDaemonStarted).toHaveBeenCalledWith("http://127.0.0.1:43999");
  });
});

const REMOTE_REPO = "/home/otomat/.otomat/instances/92584b0/test-repo";

function remoteSandbox(overrides: {
  enabled?: boolean;
  stdout?: string;
  registered: string[];
  scripts: string[];
  log?: (message: string) => void;
}) {
  return new PreviewSandbox({
    enabled: overrides.enabled ?? true,
    dataDirectory: layout(),
    templateDir: TEMPLATE_DIR,
    remoteHomeSuffix: HOME_SUFFIX,
    daemon: fakeDaemon(),
    onDaemonStarted: vi.fn(),
    log: overrides.log ?? (() => {}),
    runScript: async (options) => {
      overrides.scripts.push(options.script);
      return {
        code: 0,
        stdout: overrides.stdout ?? `OTOMAT_SANDBOX:READY:${REMOTE_REPO}`,
        stderr: "",
      };
    },
    fetchImpl: okFetch((body) => overrides.registered.push(body)),
  });
}

describe("PreviewSandbox.ensureRemote", () => {
  it("creates the fixture inside the instance and seeds it through the tunnel, once", async () => {
    const scripts: string[] = [];
    const registered: string[] = [];
    const sandbox = remoteSandbox({ scripts, registered });

    await sandbox.ensureRemote("otomat-vps", "http://127.0.0.1:43110");
    await sandbox.ensureRemote("otomat-vps", "http://127.0.0.1:43110");

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('DIR="$HOME/.otomat/instances/92584b0/test-repo"');
    expect(registered).toEqual([JSON.stringify({ path: REMOTE_REPO })]);
  });

  it("never touches a host outside preview builds", async () => {
    const scripts: string[] = [];
    const registered: string[] = [];

    await remoteSandbox({ enabled: false, scripts, registered }).ensureRemote(
      "otomat-vps",
      "http://127.0.0.1:43110",
    );

    expect(scripts).toEqual([]);
    expect(registered).toEqual([]);
  });

  it("degrades a host without git to a log line and retries on the next connect", async () => {
    const scripts: string[] = [];
    const registered: string[] = [];
    const log = vi.fn();
    const sandbox = remoteSandbox({
      scripts,
      registered,
      log,
      stdout: "OTOMAT_SANDBOX:NO_GIT:-",
    });

    await sandbox.ensureRemote("otomat-vps", "http://127.0.0.1:43110");
    await sandbox.ensureRemote("otomat-vps", "http://127.0.0.1:43110");

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Remote sandbox setup failed.*git/));
    expect(scripts).toHaveLength(2);
    expect(registered).toEqual([]);
  });
});
