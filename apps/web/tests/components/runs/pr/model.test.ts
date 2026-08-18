import type {
  CommitSubject,
  GitHubConnectionContract,
  PullRequestContract,
  PullRequestPublishability,
} from "@otomat/domain";
import {
  initialPublicationMode,
  pullRequestAcceptedSubmission,
  pullRequestConnectionModel,
} from "@web/components/runs/pr/model";
import { publicationModel } from "@web/components/runs/pr/publication-model";
import { describe, expect, it } from "vitest";

const connected: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  device_authorization: null,
  error_code: null,
  error_message: null,
};

const PUBLISHABLE: PullRequestPublishability = {
  blocker: null,
  repository: "acme/otomat",
  base_ref: "main",
  head_ref: "otomat/run/run1",
  changed_files: 2,
  additions: 12,
  deletions: 3,
  dirty: true,
};

const SUBJECT: CommitSubject = { type: "feat", scope: null, summary: "ship it" };

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
    commit_subject: null,
    commit_body: null,
    generator: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

describe("pullRequestConnectionModel", () => {
  it("asks the user to connect before publication", () => {
    expect(
      pullRequestConnectionModel(
        {
          status: "disconnected",
          login: null,
          device_authorization: null,
          error_code: "github_auth_required",
          error_message: "Sign in to GitHub to continue.",
        },
        null,
      ),
    ).toMatchObject({
      connectionLabel: "GitHub not connected",
      showConnect: true,
      connected: false,
    });
  });

  it("surfaces the device sign-in code while waiting for GitHub", () => {
    expect(
      pullRequestConnectionModel(
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
      ),
    ).toMatchObject({
      connectionLabel: "Waiting for GitHub sign-in…",
      showConnect: false,
      deviceAuthorization: { code: "ABCD-1234", url: "https://github.com/login/device" },
    });
  });

  it("reports an outdated GitHub CLI without offering to connect", () => {
    expect(
      pullRequestConnectionModel(
        {
          status: "cli_outdated",
          login: null,
          device_authorization: null,
          error_code: "github_cli_outdated",
          error_message: "GitHub CLI 2.45.0 is too old; Otomat needs 2.63.0 or newer.",
        },
        null,
      ),
    ).toMatchObject({
      connectionLabel: "GitHub CLI too old",
      showConnect: false,
      connected: false,
      errorMessage: "GitHub CLI 2.45.0 is too old; Otomat needs 2.63.0 or newer.",
    });
  });

  it("offers the real provider link once the pull request exists", () => {
    const row = pullRequest({
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
    });

    expect(pullRequestConnectionModel(connected, row)).toMatchObject({
      linkLabel: "Open PR #42",
      linkUrl: row.url,
    });
  });

  it("keeps a provider link visible when the latest update failed", () => {
    expect(
      pullRequestConnectionModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status: "open",
          publication_status: "failed",
          error_code: "github_push_failed",
          error_message: "The run branch could not be pushed to GitHub.",
        }),
      ),
    ).toMatchObject({
      errorMessage: "The run branch could not be pushed to GitHub.",
      linkLabel: "Open PR #42",
    });
  });
});

describe("initialPublicationMode", () => {
  it("opens a new publication ready for review", () => {
    expect(initialPublicationMode(null, undefined)).toBe("ready");
  });

  it("uses Draft only when the operator already chose it", () => {
    expect(initialPublicationMode(null, "draft")).toBe("draft");
  });

  it("follows a published pull request rather than the operator's older choice", () => {
    expect(initialPublicationMode(pullRequest({ status: "open" }), undefined)).toBe("ready");
  });

  it("restores Ready for review for a publication that was reset", () => {
    expect(initialPublicationMode(pullRequest({ status: "merged" }), undefined)).toBe("ready");
  });
});

describe("publicationModel", () => {
  it("offers creation on a workspace with a publishable diff, whatever its run did", () => {
    expect(publicationModel(null, PUBLISHABLE, true, false, "ready")).toMatchObject({
      actionLabel: "Create PR ready for review",
      actionDisabled: false,
      stateLabel: "Ready to publish",
    });
  });

  it("names the draft publication when the operator chose it", () => {
    expect(publicationModel(null, PUBLISHABLE, true, false, "draft")).toMatchObject({
      actionLabel: "Create draft PR",
    });
  });

  it("blocks on the technical reason rather than on the run's state", () => {
    const blocked: PullRequestPublishability = {
      ...PUBLISHABLE,
      blocker: { code: "diff_empty", message: "The workspace carries no change." },
    };

    expect(publicationModel(null, blocked, true, false, "ready")).toMatchObject({
      actionDisabled: true,
      stateLabel: "Cannot publish",
    });
  });

  it("waits for a connection before offering to publish", () => {
    expect(publicationModel(null, PUBLISHABLE, false, false, "ready")).toMatchObject({
      actionDisabled: true,
      stateLabel: "Not connected",
    });
  });

  it.each([
    ["pushing", "Pushing branch…"],
    ["creating", "Creating pull request…"],
  ] as const)("renders honest %s progress", (publicationStatus, actionLabel) => {
    expect(
      publicationModel(
        pullRequest({ publication_status: publicationStatus }),
        PUBLISHABLE,
        true,
        false,
        "ready",
      ),
    ).toMatchObject({ actionLabel, actionPending: true });
  });

  it("offers Update PR details only for edited details", () => {
    const row = pullRequest({
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
    });

    expect(publicationModel(row, PUBLISHABLE, true, false, "ready")).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: true,
      stateLabel: "Details published",
    });
    expect(publicationModel(row, PUBLISHABLE, true, true, "ready")).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: false,
      stateLabel: "Unsaved details",
    });
  });

  it("keeps a failed creation retryable", () => {
    expect(
      publicationModel(
        pullRequest({ publication_status: "failed", error_code: "github_push_failed" }),
        PUBLISHABLE,
        true,
        false,
        "ready",
      ),
    ).toMatchObject({ actionDisabled: false, stateLabel: "Creation failed" });
  });

  it.each(["merged", "closed"] as const)("makes a %s PR terminal", (status) => {
    expect(
      publicationModel(
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status,
          publication_status: "created",
        }),
        PUBLISHABLE,
        true,
        false,
        "ready",
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
          commit_subject: "feat: ship the old one",
          body: "Old body",
        }),
        { subject: SUBJECT, body: "New body", mode: "draft" },
      ),
    ).toBe(false);
  });

  it("accepts normalized empty body metadata", () => {
    expect(
      pullRequestAcceptedSubmission(pullRequest({ commit_subject: "feat: ship it", body: null }), {
        subject: SUBJECT,
        body: "",
        mode: "draft",
      }),
    ).toBe(true);
  });

  it("rejects a PR GitHub still holds as a draft after a ready submission", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({ commit_subject: "feat: ship it", body: null, status: "draft" }),
        { subject: SUBJECT, body: "", mode: "ready" },
      ),
    ).toBe(false);
  });

  it("accepts a merged PR, which is past the draft/ready question", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({ commit_subject: "feat: ship it", body: null, status: "merged" }),
        { subject: SUBJECT, body: "", mode: "ready" },
      ),
    ).toBe(true);
  });

  it("rejects a scope the daemon did not store, however close the title looks", () => {
    expect(
      pullRequestAcceptedSubmission(pullRequest({ commit_subject: "feat(pr): ship it" }), {
        subject: SUBJECT,
        body: "",
        mode: "draft",
      }),
    ).toBe(false);
  });
});
