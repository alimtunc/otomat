import { describe, expect, it } from "vitest";

import { pullRequestContractSchema } from "#domain/contracts/entities/pull-request";
import { isProviderProvedResume, stepProviderWaitSchema } from "#domain/contracts/entities/runs";
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
      issue_id: "issue1",
      run_id: "run1",
      provider: "github",
      origin: "otomat",
      provenance: "otomat",
      author_login: null,
      review_decision: null,
      checks_state: "none",
      mergeable: "unknown",
      requested_reviewers: [],
      provider_updated_at: null,
      head_sha: null,
      attachment: null,
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
        issue_id: "issue1",
        run_id: null,
        provider: "github",
        origin: "imported",
        provenance: "external",
        author_login: "octocat",
        review_decision: null,
        checks_state: "none",
        mergeable: "unknown",
        requested_reviewers: [],
        provider_updated_at: null,
        head_sha: "f".repeat(40),
        attachment: {
          attached_at: "2026-08-16T00:00:00.000Z",
          attached_by: "octocat",
          detached_at: null,
          evidence: {
            repository: "acme/repo",
            number: 42,
            base_ref: "main",
            head_ref: "contrib/fix",
            head_sha: "f".repeat(40),
            author_login: "octocat",
            status: "open",
            discovery: "manual",
            verified_at: "2026-08-16T00:00:00.000Z",
          },
        },
        number: 42,
        url: "https://github.com/acme/repo/pull/42",
        status: "open",
        publication_status: "created",
        title: "Ship it",
        body: null,
        head_ref: "contrib/fix",
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

describe("stepProviderWaitSchema", () => {
  const WAIT = {
    provider: "claude",
    reason: "Claude AI usage limit reached|4102444800",
    detected_at: "2026-08-19T12:00:00.000Z",
    provider_resume_at: "2100-01-01T00:00:00.000Z",
    resume_at: "2100-01-01T00:00:00.000Z",
  };

  it("keeps the provider's proved reset apart from the instant a resume is scheduled for", () => {
    expect(stepProviderWaitSchema.parse(WAIT)).toEqual(WAIT);
    expect(isProviderProvedResume(stepProviderWaitSchema.parse(WAIT))).toBe(true);
  });

  it("reads a rescheduled or cancelled wait as the operator's own, never the provider's", () => {
    const moved = { ...WAIT, resume_at: "2099-01-01T00:00:00.000Z" };
    expect(isProviderProvedResume(stepProviderWaitSchema.parse(moved))).toBe(false);
    const cancelled = { ...WAIT, resume_at: null };
    expect(isProviderProvedResume(stepProviderWaitSchema.parse(cancelled))).toBe(false);
  });

  it("refuses a wait that names no provider or no reason, so the UI never shows an empty cause", () => {
    expect(stepProviderWaitSchema.safeParse({ ...WAIT, provider: "" }).success).toBe(false);
    expect(stepProviderWaitSchema.safeParse({ ...WAIT, reason: "" }).success).toBe(false);
  });
});
