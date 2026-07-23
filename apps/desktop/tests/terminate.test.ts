import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

function spawnSleeper(ignoreSigterm: boolean): ChildProcess {
  const guard = ignoreSigterm ? "process.on('SIGTERM', () => {});" : "";
  // Announce readiness once the handler is registered, so the test never signals mid-boot.
  const script = `${guard} process.stdout.write('ready'); setInterval(() => {}, 1000)`;
  return spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "ignore"] });
}

function whenReady(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => child.stdout?.once("data", () => resolve()));
}

async function importTerminate() {
  return (await import("#shared/terminate")).terminateChild;
}

function fakeChild(kill: (signal?: NodeJS.Signals | number) => boolean): ChildProcess {
  return Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
    pid: 42,
    kill,
  }) as unknown as ChildProcess;
}

describe("terminateChild", () => {
  it("stops a normal child with SIGTERM", async () => {
    const terminateChild = await importTerminate();
    const child = spawnSleeper(false);
    await whenReady(child);
    await terminateChild(child, 2000);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });

  it("escalates to SIGKILL when SIGTERM is ignored", async () => {
    const terminateChild = await importTerminate();
    const child = spawnSleeper(true);
    await whenReady(child);
    await terminateChild(child, 150);
    expect(child.signalCode).toBe("SIGKILL");
  });

  it("resolves immediately for an already-exited child", async () => {
    const terminateChild = await importTerminate();
    const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    await new Promise((resolve) => child.on("exit", resolve));
    await expect(terminateChild(child, 1000)).resolves.toBeUndefined();
  });

  it("rejects when a signal cannot be delivered", async () => {
    const terminateChild = await importTerminate();
    const child = fakeChild(() => false);

    await expect(terminateChild(child, 1000)).rejects.toThrow(/Could not deliver SIGTERM/);
  });

  it("rejects when the child is still not observed exiting after SIGKILL", async () => {
    vi.useFakeTimers();
    try {
      const terminateChild = await importTerminate();
      const kill = vi.fn(() => true);
      const termination = expect(terminateChild(fakeChild(kill), 100)).rejects.toThrow(
        /did not exit after SIGKILL/,
      );

      await vi.advanceTimersByTimeAsync(200);
      await termination;
      expect(kill).toHaveBeenNthCalledWith(1, "SIGTERM");
      expect(kill).toHaveBeenNthCalledWith(2, "SIGKILL");
    } finally {
      vi.useRealTimers();
    }
  });
});
