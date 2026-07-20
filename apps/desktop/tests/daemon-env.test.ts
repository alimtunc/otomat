import { describe, expect, it } from "vitest";

import { buildDaemonEnv } from "#shared/daemon-env";

describe("buildDaemonEnv", () => {
  it("sets the daemon's loopback/port/db/project/path knobs", () => {
    const env = buildDaemonEnv({
      port: 51_234,
      dbPath: "/u/otomat.db",
      projectRoot: "/u",
      path: "/opt/bin:/usr/bin",
    });
    expect(env.OTOMAT_DAEMON_HOST).toBe("127.0.0.1");
    expect(env.OTOMAT_DAEMON_PORT).toBe("51234");
    expect(env.OTOMAT_DB_PATH).toBe("/u/otomat.db");
    expect(env.OTOMAT_PROJECT_ROOT).toBe("/u");
    expect(env.PATH).toBe("/opt/bin:/usr/bin");
  });

  it("adds the CORS allowlist + run-as-node flag only when requested", () => {
    const dev = buildDaemonEnv({ port: 1, dbPath: "d", projectRoot: "p", path: "x" });
    expect(dev.OTOMAT_ALLOWED_ORIGINS).toBeUndefined();
    expect(dev.ELECTRON_RUN_AS_NODE).toBeUndefined();

    const packaged = buildDaemonEnv({
      port: 1,
      dbPath: "d",
      projectRoot: "p",
      path: "x",
      allowedOrigin: "otomat://app",
      runAsNode: true,
    });
    expect(packaged.OTOMAT_ALLOWED_ORIGINS).toBe("otomat://app");
    expect(packaged.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("never introduces a Linear credential knob", () => {
    const env = buildDaemonEnv({
      port: 1,
      dbPath: "d",
      projectRoot: "p",
      path: "x",
      allowedOrigin: "otomat://app",
      runAsNode: true,
    });

    // The daemon re-spreads process.env into every supervised agent worker, so a
    // key placed here would reach claude/codex/git/gh. It travels over loopback
    // HTTP after the health check instead.
    expect(Object.keys(env)).not.toContain("OTOMAT_LINEAR_API_KEY");
    expect(JSON.stringify(env)).not.toContain("lin_api");
  });

  it("extends the base env but overrides PATH", () => {
    const env = buildDaemonEnv({
      port: 1,
      dbPath: "d",
      projectRoot: "p",
      path: "/resolved",
      baseEnv: { HOME: "/home/x", PATH: "/minimal" },
    });
    expect(env.HOME).toBe("/home/x");
    expect(env.PATH).toBe("/resolved");
  });
});
