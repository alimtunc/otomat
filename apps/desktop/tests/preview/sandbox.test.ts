import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedDataDirectory } from "#main/data-safety/index";
import { PreviewSandbox, type SandboxDaemon } from "#main/preview/sandbox";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));

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

function okFetch(): typeof fetch {
  return ((input: unknown) =>
    Promise.resolve(
      String(input).endsWith("/api/repositories")
        ? new Response(JSON.stringify({ project: { id: "p-1" } }), { status: 201 })
        : new Response(JSON.stringify({ id: "i" }), { status: 201 }),
    )) as typeof fetch;
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
    const daemon = fakeDaemon();
    const sandbox = new PreviewSandbox({
      enabled: false,
      dataDirectory: layout(),
      templateDir: TEMPLATE_DIR,
      daemon,
      onDaemonStarted: vi.fn(),
      log: () => {},
      fetchImpl: okFetch(),
    });

    await sandbox.ensure("http://127.0.0.1:4319");
    const result = await sandbox.reset();

    expect(result.ok).toBe(false);
    expect(daemon.stop).not.toHaveBeenCalled();
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
    expect(existsSync(join(directory.root, "test-repo", ".git"))).toBe(true);
    expect(onDaemonStarted).toHaveBeenCalledWith("http://127.0.0.1:43999");
  });

  it("still re-points the renderer when reseeding fails after the restart", async () => {
    const onDaemonStarted = vi.fn();
    const sandbox = new PreviewSandbox({
      enabled: true,
      dataDirectory: layout(),
      templateDir: TEMPLATE_DIR,
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
