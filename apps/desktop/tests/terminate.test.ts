import { spawn, type ChildProcess } from "node:child_process";

import { describe, expect, it } from "vitest";

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
});
