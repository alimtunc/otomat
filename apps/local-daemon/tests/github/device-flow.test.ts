import { describe, expect, it } from "vitest";

import { createDeviceAuthorization, type DeviceAuthorizationStart } from "#github";

const START_PAYLOAD = {
  device_code: "dev-1",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
};

function jsonResponse(payload: unknown, ok = true): Response {
  // SAFETY: the device flow reads only ok and json from a response.
  return {
    ok,
    json: async () => payload,
  } as Response;
}

function harness(responses: (Response | Error)[]) {
  const delays: number[] = [];
  let clock = 0;
  const device = createDeviceAuthorization({
    fetchImpl: async () => {
      const next = responses.shift();
      if (next === undefined) throw new Error("unexpected fetch");
      if (next instanceof Error) throw next;
      return next;
    },
    delay: async (ms) => {
      delays.push(ms);
      clock += ms;
    },
    now: () => clock,
  });
  return { device, delays };
}

function startFixture(overrides: Partial<DeviceAuthorizationStart> = {}): DeviceAuthorizationStart {
  return {
    deviceCode: "dev-1",
    userCode: "ABCD-1234",
    verificationUrl: "https://github.com/login/device",
    intervalMs: 5_000,
    expiresAt: 900_000,
    ...overrides,
  };
}

describe("GitHub device authorization", () => {
  it("starts a device sign-in and exposes the user code", async () => {
    const { device } = harness([jsonResponse(START_PAYLOAD)]);

    await expect(device.start()).resolves.toEqual(startFixture());
  });

  it("fails honestly when GitHub cannot be reached", async () => {
    const { device } = harness([new Error("offline")]);

    await expect(device.start()).rejects.toMatchObject({
      code: "github_device_flow_failed",
      message: "GitHub could not be reached to sign in.",
    });
  });

  it("polls until the user approves, honoring slow_down", async () => {
    const { device, delays } = harness([
      jsonResponse({ error: "authorization_pending" }),
      jsonResponse({ error: "slow_down" }),
      jsonResponse({ access_token: "gho_token" }),
    ]);

    await expect(device.awaitToken(startFixture())).resolves.toBe("gho_token");
    expect(delays).toEqual([5_000, 5_000, 10_000]);
  });

  it("reports an expired device code", async () => {
    const { device } = harness([jsonResponse({ error: "expired_token" })]);

    await expect(device.awaitToken(startFixture())).rejects.toMatchObject({
      code: "github_device_login_expired",
    });
  });

  it("reports a denied sign-in", async () => {
    const { device } = harness([jsonResponse({ error: "access_denied" })]);

    await expect(device.awaitToken(startFixture())).rejects.toMatchObject({
      code: "github_device_login_denied",
    });
  });

  it("stops polling when the code expires without approval", async () => {
    const { device } = harness([
      jsonResponse({ error: "authorization_pending" }),
      jsonResponse({ error: "authorization_pending" }),
    ]);

    await expect(device.awaitToken(startFixture({ expiresAt: 10_000 }))).rejects.toMatchObject({
      code: "github_device_login_expired",
    });
  });
});
