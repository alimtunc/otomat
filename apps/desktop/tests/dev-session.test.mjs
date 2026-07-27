import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import {
  DEV_SERVER_ENV,
  electronEnv,
  planDevServer,
  reserveLoopbackPort,
  viteArgs,
} from "#scripts/dev-session";
import { DEV_SERVER_ENV as SHARED_DEV_SERVER_ENV } from "#shared/constants";

function refuseReservation() {
  throw new Error("A reserved port must not be requested for the override.");
}

it("names the same variable the main process reads", () => {
  expect(DEV_SERVER_ENV).toBe(SHARED_DEV_SERVER_ENV);
});

describe("planDevServer", () => {
  it("serves this session on a port it reserved, never a shared default", async () => {
    const plan = await planDevServer({ env: {}, reservePort: async () => 51_987 });

    expect(plan).toEqual({ url: "http://127.0.0.1:51987", port: 51_987, managed: true });
  });

  it("gives two sessions different URLs from the same environment", async () => {
    const ports = [51_001, 51_002];
    const reservePort = async () => ports.shift();

    const first = await planDevServer({ env: {}, reservePort });
    const second = await planDevServer({ env: {}, reservePort });

    expect(first.url).not.toBe(second.url);
  });

  it("uses the documented override without starting or owning a server", async () => {
    const plan = await planDevServer({
      env: { [DEV_SERVER_ENV]: "http://127.0.0.1:4200/" },
      reservePort: refuseReservation,
    });

    expect(plan).toEqual({ url: "http://127.0.0.1:4200", managed: false });
  });

  it("rejects an override that is not a URL instead of falling back to a default", async () => {
    await expect(planDevServer({ env: { [DEV_SERVER_ENV]: "5173" } })).rejects.toThrow(
      /not a valid URL/,
    );
  });

  it("rejects an override Electron could not resolve to a real origin", async () => {
    await expect(
      planDevServer({
        env: { [DEV_SERVER_ENV]: "file:///tmp/index.html" },
        reservePort: refuseReservation,
      }),
    ).rejects.toThrow(/must be an http\(s\) URL/);
  });
});

describe("viteArgs", () => {
  it("pins Vite to the reserved loopback port and fails rather than drifting", () => {
    expect(viteArgs(51_987)).toEqual(["--host", "127.0.0.1", "--port", "51987", "--strictPort"]);
  });

  it("passes no separator Vite would stop parsing flags at", () => {
    expect(viteArgs(51_987)).not.toContain("--");
  });
});

describe("electronEnv", () => {
  it("hands Electron the exact URL this session serves", () => {
    const env = electronEnv(
      { PATH: "/usr/bin", [DEV_SERVER_ENV]: "http://localhost:5173" },
      "http://127.0.0.1:51987",
    );

    expect(env[DEV_SERVER_ENV]).toBe("http://127.0.0.1:51987");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("drops the run-as-node flag an Electron-hosted terminal leaks", () => {
    const env = electronEnv({ ELECTRON_RUN_AS_NODE: "1" }, "http://127.0.0.1:51987");

    expect(Object.keys(env)).not.toContain("ELECTRON_RUN_AS_NODE");
  });
});

describe("reserveLoopbackPort", () => {
  it("returns a loopback port that is free to bind", async () => {
    const port = await reserveLoopbackPort();

    await new Promise((resolve, reject) => {
      const server = createServer();
      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  });
});
