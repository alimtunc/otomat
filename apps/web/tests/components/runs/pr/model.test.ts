import type { GitHubConnectionContract, PullRequestContract } from "@otomat/domain";
import { pullRequestAcceptedSubmission, pullRequestViewModel } from "@web/components/runs/pr/model";
import { describe, expect, it } from "vitest";

const connected: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  device_authorization: null,
  error_code: null,
  error_message: null,
};

function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr1",
    run_id: "run1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "Ship it",
    body: null,
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

describe("pullRequestViewModel", () => {
  it("asks the user to connect before publication", () => {
    const model = pullRequestViewModel(
      {
        status: "disconnected",
        login: null,
        device_authorization: null,
        error_code: "github_auth_required",
        error_message: "Sign in to GitHub to continue.",
      },
      null,
    );

    expect(model).toMatchObject({
      connectionLabel: "GitHub not connected",
      showConnect: true,
      actionDisabled: true,
    });
  });

  it("surfaces the device sign-in code while waiting for GitHub", () => {
    const model = pullRequestViewModel(
      {
        status: "connecting",
        login: null,
        device_authorization: {
          user_code: "ABCD-1234",
          verification_url: "https://github.com/login/device",
        },
        error_code: null,
        error_message: null,
      },
      null,
    );

    expect(model).toMatchObject({
      connectionLabel: "Waiting for GitHub sign-in…",
      showConnect: false,
      deviceAuthorization: { code: "ABCD-1234", url: "https://github.com/login/device" },
    });
  });

  it("reports an outdated GitHub CLI without offering to connect", () => {
    const model = pullRequestViewModel(
      {
        status: "cli_outdated",
        login: null,
        device_authorization: null,
        error_code: "github_cli_outdated",
        error_message: "GitHub CLI 2.45.0 is too old; Otomat needs 2.63.0 or newer.",
      },
      null,
    );

    expect(model).toMatchObject({
      connectionLabel: "GitHub CLI too old",
      showConnect: false,
      actionDisabled: true,
      errorMessage: "GitHub CLI 2.45.0 is too old; Otomat needs 2.63.0 or newer.",
    });
  });

  it("does not claim a run is ready before it reaches review-ready", () => {
    expect(pullRequestViewModel(connected, null, false)).toMatchObject({
      actionDisabled: true,
      stateLabel: "Run not ready for publication",
    });
  });

  it.each([
    ["pushing", "Pushing branch…"],
    ["creating", "Creating pull request…"],
  ] as const)("renders honest %s progress", (publicationStatus, actionLabel) => {
    expect(
      pullRequestViewModel(connected, pullRequest({ publication_status: publicationStatus })),
    ).toMatchObject({ actionLabel, actionPending: true });
  });

  it("offers the real link, and Update PR details only for edited details", () => {
    const row = pullRequest({
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
    });

    expect(pullRequestViewModel(connected, row)).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: true,
      stateLabel: "Details published",
      linkLabel: "Open PR #42",
      linkUrl: row.url,
    });
    expect(pullRequestViewModel(connected, row, true, true)).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: false,
      stateLabel: "Unsaved details",
    });
  });

  it("keeps a provider link visible when the latest update failed", () => {
    const model = pullRequestViewModel(
      connected,
      pullRequest({
        number: 42,
        url: "https://github.com/acme/otomat/pull/42",
        status: "open",
        publication_status: "failed",
        error_code: "github_push_failed",
        error_message: "The run branch could not be pushed to GitHub.",
      }),
    );

    expect(model).toMatchObject({
      stateLabel: "Update failed",
      errorMessage: "The run branch could not be pushed to GitHub.",
      linkLabel: "Open PR #42",
    });
  });

  it("keeps an existing pull request editable once its run is no longer review-ready", () => {
    expect(
      pullRequestViewModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status: "open",
          publication_status: "created",
        }),
        false,
        true,
      ),
    ).toMatchObject({ actionLabel: "Update PR details", actionDisabled: false });
  });

  it.each(["merged", "closed"] as const)("makes a %s PR terminal", (status) => {
    expect(
      pullRequestViewModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status,
          publication_status: "created",
        }),
      ),
    ).toMatchObject({ actionDisabled: true, stateLabel: `PR ${status}` });
  });
});

describe("pullRequestAcceptedSubmission", () => {
  it("rejects a failed result that retained older metadata", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({
          publication_status: "failed",
          title: "Old title",
          body: "Old body",
        }),
        { title: "New title", body: "New body", mode: "draft" },
      ),
    ).toBe(false);
  });

  it("accepts normalized empty body metadata", () => {
    expect(
      pullRequestAcceptedSubmission(pullRequest({ title: "Ship it", body: null }), {
        title: "Ship it",
        body: "",
        mode: "draft",
      }),
    ).toBe(true);
  });

  it("rejects a PR GitHub still holds as a draft after a ready submission", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({ title: "Ship it", body: null, status: "draft" }),
        {
          title: "Ship it",
          body: "",
          mode: "ready",
        },
      ),
    ).toBe(false);
  });

  it("accepts a merged PR, which is past the draft/ready question", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({ title: "Ship it", body: null, status: "merged" }),
        { title: "Ship it", body: "", mode: "ready" },
      ),
    ).toBe(true);
  });
});
