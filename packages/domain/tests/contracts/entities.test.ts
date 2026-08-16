import { describe, expect, it } from "vitest";

import { pullRequestContractSchema } from "#domain/contracts/entities/pull-request";
import { repositoryContractSchema } from "#domain/contracts/entities/workspace";

describe("repository contract", () => {
  it("parses a pre-field daemon payload without init_commands", () => {
    expect(
      repositoryContractSchema.parse({
        id: "r1",
        project_id: "p1",
        name: "app",
        remote_url: null,
        default_branch: "main",
        available: true,
      }).init_commands,
    ).toEqual([]);
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
      commit_subject: "feat(pr): ship it",
      commit_body: null,
      generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
      published_head_sha: "abc123",
      published_diff_sha: "diff123",
      error_code: null,
      error_message: null,
    });

    expect(parsed).toMatchObject({
      status: "open",
      publication_status: "created",
      head_ref: "otomat/run/run1",
      base_ref: "main",
      commit_subject: "feat(pr): ship it",
      commit_body: null,
      generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
      published_head_sha: "abc123",
      published_diff_sha: "diff123",
    });
  });

  it("accepts a pull request adopted from GitHub before Otomat ever pushed to it", () => {
    expect(
      pullRequestContractSchema.parse({
        id: "pr1",
        run_id: "run1",
        provider: "github",
        number: 42,
        url: "https://github.com/acme/repo/pull/42",
        status: "open",
        publication_status: "created",
        title: "Ship it",
        body: null,
        head_ref: "otomat/run/run1",
        base_ref: "main",
        commit_subject: null,
        commit_body: null,
        generator: null,
        published_head_sha: null,
        published_diff_sha: null,
        error_code: null,
        error_message: null,
      }).published_head_sha,
    ).toBeNull();
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
      }),
    ).toThrow();
  });
});
