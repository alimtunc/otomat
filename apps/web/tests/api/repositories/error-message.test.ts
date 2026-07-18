import { DaemonRequestError } from "@otomat/client";
import { registerRepositoryErrorMessage } from "@web/api/repositories/mutations";
import { describe, expect, it } from "vitest";

describe("registerRepositoryErrorMessage", () => {
  it("surfaces the daemon's safe refusal message verbatim", () => {
    const error = new DaemonRequestError(409, "/api/repositories", {
      error: "repository_already_registered",
      message: "This repository is already registered.",
    });
    expect(registerRepositoryErrorMessage(error)).toBe("This repository is already registered.");
  });

  it("falls back honestly when the body is not a refusal payload", () => {
    const error = new DaemonRequestError(500, "/api/repositories", { error: "internal_error" });
    expect(registerRepositoryErrorMessage(error)).toBe(
      "Could not register the repository — the daemon rejected the request.",
    );
  });

  it("points at the daemon when the request never got a response", () => {
    expect(registerRepositoryErrorMessage(new TypeError("fetch failed"))).toBe(
      "Could not register the repository — is the daemon running?",
    );
  });
});
