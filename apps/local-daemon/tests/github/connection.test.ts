import { describe, expect, it } from "vitest";

import {
  createGitHubConnectionService,
  type DeviceAuthorization,
  type DeviceAuthorizationStart,
  type GitHubCli,
} from "#github";

import {
  CONNECTED_GITHUB as CONNECTED,
  DISCONNECTED_GITHUB as DISCONNECTED,
} from "../support/github.js";

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
    availability: async () => null,
    remoteBranchExists: async () => true,
    remoteBranchProtected: async () => true,
    searchPullRequests: async () => [],
    listOpenPullRequests: async () => [],
    viewerTeams: async () => [],
    loginWithToken: async (token: string) => {
      tokens.push(token);
      current = CONNECTED;
      return current;
    },
    resolveRemote: () => Promise.reject(new Error("not used")),
    push: () => Promise.reject(new Error("not used")),
    forcePushWithLease: () => Promise.reject(new Error("not used")),
    remoteHead: () => Promise.reject(new Error("not used")),
    fetchBranch: () => Promise.reject(new Error("not used")),
    findPullRequest: () => Promise.reject(new Error("not used")),
    viewPullRequest: () => Promise.reject(new Error("not used")),
    createPullRequest: () => Promise.reject(new Error("not used")),
    updatePullRequest: () => Promise.reject(new Error("not used")),
    setPullRequestMode: () => Promise.reject(new Error("not used")),
    createReviewComment: () => Promise.reject(new Error("not used")),
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

  it("fails before starting the device grant when gh cannot run", async () => {
    const cli = fakeCli();
    cli.availability = async () => ({
      status: "not_installed",
      login: null,
      device_authorization: null,
      error_code: "github_cli_missing",
      error_message: "Install GitHub CLI to connect Otomat to GitHub.",
    });
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
    await settle();

    expect(starts).toBe(0);
    expect(cli.tokens).toEqual([]);
    await expect(service.connection()).resolves.toMatchObject({
      status: "not_installed",
      error_code: "github_cli_missing",
    });
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
