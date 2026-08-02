import { describe, expect, it } from "vitest";

import { githubConnectionContractSchema } from "#domain/contracts/github";

describe("GitHub connection contract", () => {
  it("carries honest connection state without credentials", () => {
    expect(
      githubConnectionContractSchema.parse({
        status: "connected",
        login: "octocat",
        device_authorization: null,
        error_code: null,
        error_message: null,
      }),
    ).toEqual({
      status: "connected",
      login: "octocat",
      device_authorization: null,
      error_code: null,
      error_message: null,
    });
  });

  it("surfaces the device sign-in code while a headless login is pending", () => {
    expect(
      githubConnectionContractSchema.parse({
        status: "connecting",
        login: null,
        device_authorization: {
          user_code: "ABCD-1234",
          verification_url: "https://github.com/login/device",
        },
        error_code: null,
        error_message: null,
      }).device_authorization,
    ).toEqual({ user_code: "ABCD-1234", verification_url: "https://github.com/login/device" });
  });
});
