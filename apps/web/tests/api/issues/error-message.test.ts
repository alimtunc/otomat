import { DaemonRequestError } from "@otomat/client";
import { issueStatusErrorMessage } from "@web/api/issues/mutations";
import { describe, expect, it } from "vitest";

describe("issueStatusErrorMessage", () => {
  it("surfaces the daemon's refusal message verbatim", () => {
    const error = new DaemonRequestError(409, "PATCH", "/api/issues/i1/status", {
      error: "issue_not_local",
      message: "A linear issue takes its status from its tracker; set it there instead.",
    });
    expect(issueStatusErrorMessage(error)).toBe(
      "A linear issue takes its status from its tracker; set it there instead.",
    );
  });

  it("falls back honestly when the body is not a refusal payload", () => {
    const error = new DaemonRequestError(400, "PATCH", "/api/issues/i1/status", {
      error: "invalid_request",
    });
    expect(issueStatusErrorMessage(error)).toBe(
      "Could not change this status — the daemon rejected the request.",
    );
  });

  it("points at the daemon when the request never got a response", () => {
    expect(issueStatusErrorMessage(new TypeError("fetch failed"))).toBe(
      "Could not change this status — is the daemon running?",
    );
  });
});
