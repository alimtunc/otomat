import { DaemonRequestError } from "@otomat/client";
import { pullRequestGenerationRefusal } from "@web/lib/pull-request/generation-refusal";
import { describe, expect, it } from "vitest";

import { pullRequest } from "#support/pull-request";

const REFUSAL = "The subject is 79 characters; remove 7 to stay within 72.";

function refused(body: unknown): DaemonRequestError {
  return new DaemonRequestError(409, "POST", "/api/runs/run-1/pr/generate", body);
}

describe("pullRequestGenerationRefusal", () => {
  it("reads the sentence an explicit generation answered the caller with", () => {
    expect(
      pullRequestGenerationRefusal(
        refused({ error: "pr_generation_invalid", message: REFUSAL }),
        null,
      ),
    ).toBe(REFUSAL);
  });

  it("reads the sentence a compact publication persisted on the row", () => {
    expect(
      pullRequestGenerationRefusal(
        null,
        pullRequest({
          publication_status: "failed",
          error_code: "pr_generation_invalid",
          error_message: REFUSAL,
        }),
      ),
    ).toBe(REFUSAL);
  });

  it("drops the row's refusal once a subject is written", () => {
    expect(
      pullRequestGenerationRefusal(
        null,
        pullRequest({
          publication_status: "failed",
          commit_subject: "feat(pr): ship it",
          error_code: "pr_generation_invalid",
          error_message: REFUSAL,
        }),
      ),
    ).toBeNull();
  });

  it("drops the row's refusal once the operator's own publication is running", () => {
    expect(
      pullRequestGenerationRefusal(
        null,
        pullRequest({
          publication_status: "committing",
          error_code: "pr_generation_invalid",
          error_message: REFUSAL,
        }),
      ),
    ).toBeNull();
  });

  it("stays silent for a failure the commit-subject contract did not refuse", () => {
    expect(
      pullRequestGenerationRefusal(
        refused({ error: "pr_generation_failed", message: "gone" }),
        null,
      ),
    ).toBeNull();
    expect(
      pullRequestGenerationRefusal(
        new Error("offline"),
        pullRequest({
          publication_status: "failed",
          error_code: "github_push_failed",
          error_message: "The push failed.",
        }),
      ),
    ).toBeNull();
  });
});
