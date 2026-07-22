import { describe, expect, it } from "vitest";

import { pullRequestContractSchema } from "#domain/contracts/entities/pull-request";

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

  it("rejects a created publication without confirmed provider metadata", () => {
    expect(() =>
      pullRequestContractSchema.parse({
        id: "pr1",
        run_id: "run1",
        provider: "github",
        number: null,
        url: null,
        status: "open",
        publication_status: "created",
        title: "Ship it",
        body: null,
        head_ref: null,
        base_ref: null,
        published_head_sha: null,
        published_diff_sha: null,
        error_code: null,
        error_message: null,
        has_unpublished_changes: false,
      }),
    ).toThrow();
  });
});
