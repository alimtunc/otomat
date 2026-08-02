import type { GitHubConnectionContract } from "@otomat/domain";
import { describe, expect, it } from "vitest";

import {
  createGitHubConnectionService,
  type DeviceAuthorization,
  type DeviceAuthorizationStart,
  type GitHubCli,
} from "#github";

const CONNECTED: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  device_authorization: null,
  error_code: null,
  error_message: null,
};

const DISCONNECTED: GitHubConnectionContract = {
  status: "disconnected",
  login: null,
  device_authorization: null,
  error_code: "github_auth_required",
  error_message: "Sign in to GitHub to continue.",
};

const START: DeviceAuthorizationStart = {
  deviceCode: "dev-1",
  userCode: "ABCD-1234",
  verificationUrl: "https://github.com/login/device",
  intervalMs: 5_000,
  expiresAt: 900_000,
};

function fakeCli(): GitHubCli & { tokens: string[] } {
  const tokens: string[] = [];
  let current = DISCONNECTED;
  return {
    tokens,
    connection: async () => current,
    loginWithToken: async (token: string) => {
      tokens.push(token);
      current = CONNECTED;
      return current;
    },
    resolveRemote: () => Promise.reject(new Error("not used")),
    push: () => Promise.reject(new Error("not used")),
    findPullRequest: () => Promise.reject(new Error("not used")),
    viewPullRequest: () => Promise.reject(new Error("not used")),
    createPullRequest: () => Promise.reject(new Error("not used")),
    updatePullRequest: () => Promise.reject(new Error("not used")),
  };
}

function noop(): void {}

function manualDevice(): DeviceAuthorization & {
  approve: (token: string) => void;
  reject: (error: Error) => void;
} {
  let resolveToken: (token: string) => void = noop;
  let rejectToken: (error: Error) => void = noop;
  return {
    approve: (token) => resolveToken(token),
    reject: (error) => rejectToken(error),
    start: async () => START,
    awaitToken: () =>
      new Promise<string>((resolve, reject) => {
        resolveToken = resolve;
        rejectToken = reject;
      }),
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GitHub connection service", () => {
  it("surfaces the device code while the sign-in is pending", async () => {
    const cli = fakeCli();
    const device = manualDevice();
    const service = createGitHubConnectionService(cli, device);

    expect(service.connect().status).toBe("connecting");
    await settle();

    await expect(service.connection()).resolves.toEqual({
      status: "connecting",
      login: null,
      device_authorization: {
        user_code: "ABCD-1234",
        verification_url: "https://github.com/login/device",
      },
      error_code: null,
      error_message: null,
    });

    device.approve("gho_token");
    await settle();

    await expect(service.connection()).resolves.toEqual(CONNECTED);
    expect(cli.tokens).toEqual(["gho_token"]);
  });

  it("keeps a sticky failure when the sign-in is denied", async () => {
    const cli = fakeCli();
    const device = manualDevice();
    const service = createGitHubConnectionService(cli, device);

    service.connect();
    await settle();
    device.reject(new Error("denied out of band"));
    await settle();

    await expect(service.connection()).resolves.toMatchObject({
      status: "failed",
      device_authorization: null,
      error_code: "github_connection_failed",
    });
  });

  it("starts a single sign-in for concurrent connect calls", async () => {
    const cli = fakeCli();
    let starts = 0;
    const device = manualDevice();
    const countingDevice: DeviceAuthorization = {
      start: async () => {
        starts += 1;
        return device.start();
      },
      awaitToken: device.awaitToken,
    };
    const service = createGitHubConnectionService(cli, countingDevice);

    service.connect();
    service.connect();
    await settle();

    expect(starts).toBe(1);
    device.approve("gho_token");
    await settle();
    expect(cli.tokens).toEqual(["gho_token"]);
  });
});
