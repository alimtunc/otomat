import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, expect, it, vi } from "vitest";

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly pid = 42;
}

async function createControllerHarness(
  waitForHealth: (options: { signal?: AbortSignal }) => Promise<void> = async () => {},
  terminateChild: () => Promise<void> = async () => {},
) {
  const children: FakeChild[] = [];
  const spawn = vi.fn(() => {
    const child = new FakeChild();
    children.push(child);
    return child;
  });
  vi.doMock("node:child_process", () => ({ spawn }));
  vi.doMock("#shared/ports", () => ({ findFreeLoopbackPort: async () => 4319 }));
  vi.doMock("#shared/health", () => ({ waitForHealth }));
  vi.doMock("#shared/terminate", () => ({ terminateChild }));
  const { DaemonController } = await import("#main/daemon");
  return {
    children,
    spawn,
    controller: new DaemonController({
      daemonEntry: "/tmp/daemon.js",
      dbPath: "/tmp/otomat.db",
      projectRoot: "/tmp",
      userPath: "/usr/bin",
      packaged: false,
      electronBinary: "/tmp/electron",
      baseEnv: {},
      writeLog: vi.fn(),
    }),
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("node:child_process");
  vi.doUnmock("#shared/ports");
  vi.doUnmock("#shared/health");
  vi.doUnmock("#shared/terminate");
});

it("coalesces concurrent restore requests into one maintenance child", async () => {
  const harness = await createControllerHarness();
  const first = harness.controller.restoreBackup("/tmp/backups/otomat-backup.sqlite");
  const second = harness.controller.restoreBackup("/tmp/backups/otomat-backup.sqlite");
  await vi.waitFor(() => expect(harness.spawn).toHaveBeenCalledTimes(1));

  harness.children[0]?.emit("close", 0);

  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  expect(harness.controller.running).toBe(false);
});

it("preserves unicode diagnostic paths when a codepoint is split across chunks", async () => {
  const harness = await createControllerHarness();
  const restore = harness.controller.restoreBackup("/tmp/backups/otomat-backup.sqlite");
  await vi.waitFor(() => expect(harness.spawn).toHaveBeenCalledTimes(1));
  const child = harness.children[0];
  if (child === undefined) throw new Error("Expected a maintenance child");
  const line = Buffer.from(
    '[otomat-startup-diagnostic] {"code":"database_missing","message":"Missing","backup_path":"/tmp/é/otomat-backup.sqlite","available_bytes":null,"required_bytes":null}\n',
  );
  const splitAt = line.indexOf(Buffer.from("é")) + 1;
  child.stderr.write(line.subarray(0, splitAt));
  child.stderr.write(line.subarray(splitAt));
  child.emit("close", 1);

  await expect(restore).rejects.toMatchObject({
    diagnostic: { backup_path: "/tmp/é/otomat-backup.sqlite" },
  });
});

it("drains a diagnostic emitted after exit before reporting startup failure", async () => {
  const harness = await createControllerHarness(
    async ({ signal }) =>
      new Promise((_resolve, reject) => {
        if (signal?.aborted === true) {
          reject(new Error("aborted"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  );
  const startup = harness.controller.start();
  await vi.waitFor(() => expect(harness.spawn).toHaveBeenCalledTimes(1));
  const child = harness.children[0];
  if (child === undefined) throw new Error("Expected a daemon child");

  child.emit("exit", 1);
  child.stderr.write(
    '[otomat-startup-diagnostic] {"code":"database_missing","message":"Missing","backup_path":null,"available_bytes":null,"required_bytes":null}\n',
  );
  child.emit("close", 1);

  await expect(startup).rejects.toMatchObject({
    diagnostic: { code: "database_missing" },
  });
});

it("does not spawn restore maintenance when the active daemon cannot be terminated", async () => {
  const harness = await createControllerHarness(undefined, async () => {
    throw new Error("daemon remained alive");
  });
  await harness.controller.start();

  const restore = harness.controller.restoreBackup("/tmp/backups/otomat-backup.sqlite");
  harness.children[0]?.emit("close", null);

  await expect(restore).rejects.toThrow("daemon remained alive");
  expect(harness.spawn).toHaveBeenCalledTimes(1);
});
