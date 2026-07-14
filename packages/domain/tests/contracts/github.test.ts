import { describe, expect, it } from "vitest";

import { githubConnectionContractSchema } from "#domain/contracts/api";
import { pullRequestContractSchema } from "#domain/contracts/entities";

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

describe("pull request contract", () => {
  it("separates provider lifecycle from durable publication state", () => {
    const parsed = pullRequestContractSchema.parse({
      id: "pr1",
      run_id: "run1",
      provider: "github",
      number: 42,
      url: "https://github.com/acme/repo/pull/42",
      status: "open",
      publication_status: "created",
      title: "Ship it",
      body: "Body",
      head_ref: "otomat/run/run1",
      base_ref: "main",
      published_head_sha: "abc123",
      published_diff_sha: "diff123",
      error_code: null,
      error_message: null,
      has_unpublished_changes: false,
    });

    expect(parsed).toMatchObject({
      status: "open",
      publication_status: "created",
      head_ref: "otomat/run/run1",
      base_ref: "main",
      published_head_sha: "abc123",
      published_diff_sha: "diff123",
      has_unpublished_changes: false,
    });
  });
});
