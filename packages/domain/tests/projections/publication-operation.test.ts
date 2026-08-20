import { describe, expect, it } from "vitest";

import {
  projectPullRequestPublicationOperation,
  PUBLICATION_INTERRUPTED_CODE,
  type PullRequestPublicationFacts,
} from "#domain/projections/publication-operation";
import { PULL_REQUEST_PUBLICATION_ACTIVE_STATES } from "#domain/state-machines/pull-request-publication";

const UPDATED_AT = "2026-08-20T09:00:00.000Z";

function facts(overrides: Partial<PullRequestPublicationFacts> = {}): PullRequestPublicationFacts {
  return {
    publication_status: "not_configured",
    failed_phase: null,
    error_code: null,
    error_message: null,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

function stateOf(overrides: Partial<PullRequestPublicationFacts>) {
  return projectPullRequestPublicationOperation("pr1", facts(overrides));
}

describe("projectPullRequestPublicationOperation", () => {
  it("answers with no operation while none was ever started", () => {
    expect(stateOf({})).toBeNull();
  });

  it.each(PULL_REQUEST_PUBLICATION_ACTIVE_STATES)("reports %s as running", (status) => {
    const operation = stateOf({ publication_status: status });

    expect(operation).toMatchObject({ id: "pr1", kind: "pull_request_publication" });
    expect(operation?.state).toBe("running");
    expect(operation?.retryable).toBe(false);
    expect(operation?.phases.filter((phase) => phase.state === "active")).toHaveLength(1);
  });

  it("marks every phase before the running one as done", () => {
    expect(stateOf({ publication_status: "pushing" })?.phases.map((phase) => phase.state)).toEqual([
      "done",
      "done",
      "active",
      "pending",
    ]);
  });

  it("reports a created publication as succeeded with every phase behind it", () => {
    const operation = stateOf({ publication_status: "created" });

    expect(operation?.state).toBe("succeeded");
    expect(operation?.retryable).toBe(false);
    expect(operation?.phases.every((phase) => phase.state === "done")).toBe(true);
  });

  it("attributes no error to a publication that succeeded before another command failed", () => {
    const operation = stateOf({
      publication_status: "created",
      error_code: "github_push_failed",
      error_message: "The commits could not be pushed to GitHub.",
    });

    expect(operation).toMatchObject({ state: "succeeded", retryable: false, error: null });
  });

  it("keeps the phase a failure stopped in, with its reason and a safe retry", () => {
    const operation = stateOf({
      publication_status: "failed",
      failed_phase: "pushing",
      error_code: "github_push_failed",
      error_message: "The commits could not be pushed to GitHub.",
    });

    expect(operation?.state).toBe("failed");
    expect(operation?.retryable).toBe(true);
    expect(operation?.error).toEqual({
      code: "github_push_failed",
      message: "The commits could not be pushed to GitHub.",
    });
    expect(operation?.phases.map((phase) => phase.state)).toEqual([
      "done",
      "done",
      "failed",
      "pending",
    ]);
  });

  it("tells a stopped daemon apart from a failure the publication itself produced", () => {
    const operation = stateOf({
      publication_status: "failed",
      failed_phase: "creating",
      error_code: PUBLICATION_INTERRUPTED_CODE,
      error_message: "The GitHub publication stopped while creating the pull request.",
    });

    expect(operation?.state).toBe("interrupted");
    expect(operation?.retryable).toBe(true);
  });

  it("reports a publication a missing connection stopped as retryable, not as absent", () => {
    const operation = stateOf({
      publication_status: "not_configured",
      failed_phase: "committing",
      error_code: "github_auth_required",
      error_message: "Sign in to GitHub to continue.",
    });

    expect(operation).toMatchObject({ state: "failed", retryable: true });
    expect(operation?.phases[1]?.state).toBe("failed");
  });
});
