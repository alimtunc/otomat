import type { HealthResponse, RemoteHostStatus } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import { STABLE_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import { RemoteHostSession } from "#main/remote/session";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";
import type { SshTunnelOptions, TunnelHandle } from "#main/remote/ssh/tunnel";

const STARTED: SshScriptResult = { code: 0, stdout: "OTOMAT_REMOTE:STARTED:100\n", stderr: "" };

const HEALTHY: HealthResponse = {
  status: "ok",
  name: "otomat-local-daemon",
  version: "0.1.0",
  build: "abc1234",
  started_at: "2026-07-19T00:00:00.000Z",
  db_path: "/root/.otomat/data/otomat.db",
  schema: { migration_count: 14, latest_migration_at: null, page_count: 1, page_size: 4096 },
};

class FakeTunnel implements TunnelHandle {
  running = false;
  stopped = false;
  constructor(readonly options: SshTunnelOptions) {}
  start(): void {
    this.running = true;
  }
  stop(): Promise<void> {
    this.running = false;
    this.stopped = true;
    this.options.onExit({ code: null, stderrTail: "", expected: true });
    return Promise.resolve();
  }
  drop(stderrTail: string): void {
    this.running = false;
    this.options.onExit({ code: 255, stderrTail, expected: false });
  }
}

function harness(overrides?: {
  runScript?: () => Promise<SshScriptResult>;
  health?: () => Promise<HealthResponse>;
}) {
  const statuses: RemoteHostStatus[] = [];
  const tunnels: FakeTunnel[] = [];
  const retries: Array<() => void> = [];
  const runScript = vi.fn<(request: RunSshScriptOptions) => Promise<SshScriptResult>>(
    overrides?.runScript ?? (() => Promise.resolve(STARTED)),
  );
  const health = vi.fn(overrides?.health ?? (() => Promise.resolve(HEALTHY)));
  const session = new RemoteHostSession({
    alias: "otomat-vps",
    deployment: STABLE_DEPLOYMENT,
    log: () => {},
    onStatus: (status) => statuses.push(status),
    runScript,
    createTunnel: (options) => {
      const tunnel = new FakeTunnel(options);
      tunnels.push(tunnel);
      return tunnel;
    },
    health,
    reservePort: () => Promise.resolve(45_000),
    scheduleRetry: (callback) => {
      retries.push(callback);
      return 0 as unknown as NodeJS.Timeout;
    },
  });
  return { session, statuses, tunnels, retries, runScript, health };
}

function phases(statuses: RemoteHostStatus[]): string[] {
  return statuses.map((status) => status.phase);
}

it("declares connected only after a health response came back through the tunnel", async () => {
  const { session, statuses, tunnels, health } = harness();
  const status = await session.connect(false);
  expect(status.phase).toBe("connected");
  expect(phases(statuses)).toEqual([
    "checking_host",
    "starting_daemon",
    "opening_tunnel",
    "connected",
  ]);
  expect(session.url).toBe("http://127.0.0.1:45000");
  expect(session.remoteBuild).toBe("abc1234");
  expect(tunnels).toHaveLength(1);
  expect(health).toHaveBeenCalledWith(
    expect.objectContaining({ url: "http://127.0.0.1:45000/api/health" }),
  );
});

it("surfaces an ssh failure as an honest error without retrying interactively", async () => {
  const { session, retries } = harness({
    runScript: () =>
      Promise.resolve({ code: 255, stdout: "", stderr: "Permission denied (publickey)" }),
  });
  const status = await session.connect(false);
  expect(status).toMatchObject({ phase: "error", code: "ssh_unreachable" });
  expect(status.detail).toContain("Permission denied");
  expect(retries).toHaveLength(0);
});

it("reports a missing remote daemon install verbatim", async () => {
  const { session } = harness({
    runScript: () =>
      Promise.resolve({
        code: 0,
        stdout: "OTOMAT_REMOTE:NO_DAEMON:/home/u/.otomat/daemon/dist/index.js\n",
        stderr: "",
      }),
  });
  const status = await session.connect(false);
  expect(status).toMatchObject({ phase: "error", code: "daemon_missing" });
  expect(status.detail).toContain("/home/u/.otomat/daemon/dist/index.js");
});

it("tears the tunnel down when health never answers", async () => {
  const { session, tunnels } = harness({
    health: () => Promise.reject(new Error("daemon health check timed out after 15000ms")),
  });
  const status = await session.connect(false);
  expect(status).toMatchObject({ phase: "error", code: "health_failed" });
  expect(tunnels[0]?.stopped).toBe(true);
});

it("keeps cycling through reconnecting on background failures until the host recovers", async () => {
  const runScript = vi
    .fn<() => Promise<SshScriptResult>>()
    .mockResolvedValueOnce({ code: 255, stdout: "", stderr: "no route to host" })
    .mockResolvedValue(STARTED);
  const { session, statuses, retries } = harness({ runScript });
  const status = await session.connect(true);
  expect(status.phase).toBe("reconnecting");
  expect(retries).toHaveLength(1);
  retries[0]?.();
  await vi.waitFor(() => expect(session.status.phase).toBe("connected"));
  expect(phases(statuses)).toContain("reconnecting");
});

it("re-enters the reconnect loop on an unexpected tunnel drop, keeping the same local port", async () => {
  const { session, tunnels, retries } = harness();
  await session.connect(false);
  tunnels[0]?.drop("connection reset");
  expect(session.status.phase).toBe("reconnecting");
  expect(retries).toHaveLength(1);
  retries[0]?.();
  await vi.waitFor(() => expect(session.status.phase).toBe("connected"));
  expect(session.url).toBe("http://127.0.0.1:45000");
  expect(tunnels).toHaveLength(2);
});

it("stops reconnecting once disposed", async () => {
  const { session, retries } = harness({
    runScript: () => Promise.resolve({ code: 255, stdout: "", stderr: "down" }),
  });
  await session.connect(true);
  expect(retries).toHaveLength(1);
  await session.dispose();
  retries[0]?.();
  expect(session.status.phase).toBe("disconnected");
});

it("refreshDaemon enters the reconnect loop when the daemon does not come back at once", async () => {
  const runScript = vi
    .fn<() => Promise<SshScriptResult>>()
    .mockResolvedValueOnce(STARTED)
    .mockResolvedValueOnce({ code: 0, stdout: "OTOMAT_REMOTE:STOPPED:-\n", stderr: "" })
    .mockResolvedValueOnce({ code: 255, stdout: "", stderr: "no route to host" })
    .mockResolvedValue(STARTED);
  const { session, retries } = harness({ runScript });
  await session.connect(false);

  const status = await session.refreshDaemon();

  expect(status.phase).toBe("reconnecting");
  expect(retries).toHaveLength(1);
  retries[0]?.();
  await vi.waitFor(() => expect(session.status.phase).toBe("connected"));
});

it("refreshDaemon keeps the session serving when the stop script fails", async () => {
  const runScript = vi
    .fn<() => Promise<SshScriptResult>>()
    .mockResolvedValueOnce(STARTED)
    .mockResolvedValueOnce({ code: 255, stdout: "", stderr: "ssh: connect refused" });
  const { session, tunnels } = harness({ runScript });
  await session.connect(false);

  await expect(session.refreshDaemon()).rejects.toThrow("remote daemon stop exited 255");

  expect(session.status.phase).toBe("connected");
  expect(tunnels[0]?.running).toBe(true);
});

it("never leaves a tunnel behind when disposed mid-connect", async () => {
  let releaseBootstrap: (result: SshScriptResult) => void = () => {};
  const runScript = vi.fn(
    () =>
      new Promise<SshScriptResult>((resolve) => {
        releaseBootstrap = resolve;
      }),
  );
  const { session, tunnels } = harness({ runScript });
  const pending = session.connect(false);
  await vi.waitFor(() => expect(runScript).toHaveBeenCalled());
  const disposal = session.dispose();
  releaseBootstrap(STARTED);
  const status = await pending;
  await disposal;

  expect(status.phase).toBe("disconnected");
  expect(tunnels).toHaveLength(0);
});

it("refreshDaemon stops the remote daemon then reconnects on the same port", async () => {
  const { session, runScript, tunnels } = harness();
  await session.connect(false);

  const status = await session.refreshDaemon();

  expect(status.phase).toBe("connected");
  expect(session.url).toBe("http://127.0.0.1:45000");
  const scripts = runScript.mock.calls.map(([request]) => request.script);
  expect(scripts.some((script) => script.includes("OTOMAT_REMOTE:STOPPED"))).toBe(true);
  expect(tunnels).toHaveLength(2);
  expect(tunnels[0]?.stopped).toBe(true);
  expect(tunnels[1]?.running).toBe(true);
});
