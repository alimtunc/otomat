import { describe, expect, it } from "vitest";

import { githubConnectionContractSchema } from "#domain/contracts/api";

describe("GitHub connection contract", () => {
  it("carries honest connection state without credentials", () => {
    expect(
      githubConnectionContractSchema.parse({
        status: "connected",
        login: "octocat",
        error_code: null,
        error_message: null,
      }),
    ).toEqual({
      status: "connected",
      login: "octocat",
      error_code: null,
      error_message: null,
    });
  });
});
