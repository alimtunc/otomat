import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import { SshTunnel, tunnelArgs, type TunnelExitInfo } from "#main/remote/ssh/tunnel";

class FakeSshChild extends EventEmitter {
  stderr = new EventEmitter();
  pid = 4321;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  kill = vi.fn((signal: NodeJS.Signals) => {
    this.signalCode = signal;
    queueMicrotask(() => {
      this.emit("exit", null, signal);
      this.emit("close", null);
    });
    return true;
  });
}

function makeTunnel(onExit: (info: TunnelExitInfo) => void): {
  tunnel: SshTunnel;
  child: FakeSshChild;
} {
  const child = new FakeSshChild();
  const tunnel = new SshTunnel({
    alias: "otomat-vps",
    localPort: 45123,
    remotePort: 4319,
    onExit,
    spawnImpl: (() => child) as unknown as typeof import("node:child_process").spawn,
  });
  return { tunnel, child };
}

it("forwards loopback-to-loopback only, without prompts, failing closed on forward errors", () => {
  const args = tunnelArgs("otomat-vps", 45123, 4319);
  expect(args).toContain("-N");
  expect(args).toContain("BatchMode=yes");
  expect(args).toContain("ExitOnForwardFailure=yes");
  expect(args).toContain("127.0.0.1:45123:127.0.0.1:4319");
  expect(args.at(-1)).toBe("otomat-vps");
  expect(args.join(" ")).not.toContain("0.0.0.0");
});

it("reports an unexpected drop with the stderr tail", () => {
  const exits: TunnelExitInfo[] = [];
  const { tunnel, child } = makeTunnel((info) => exits.push(info));
  tunnel.start();
  child.stderr.emit("data", Buffer.from("connection reset by peer\n"));
  child.emit("close", 255);
  expect(exits).toEqual([{ code: 255, stderrTail: "connection reset by peer", expected: false }]);
  expect(tunnel.running).toBe(false);
});

it("marks a stop-initiated exit as expected", async () => {
  const exits: TunnelExitInfo[] = [];
  const { tunnel, child } = makeTunnel((info) => exits.push(info));
  tunnel.start();
  await tunnel.stop();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  expect(exits.map((info) => info.expected)).toEqual([true]);
});
