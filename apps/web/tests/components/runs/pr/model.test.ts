import {
  projectPullRequestPublicationOperation,
  PUBLICATION_INTERRUPTED_CODE,
  type GitHubConnectionContract,
  type PullRequestContract,
  type PullRequestPublicationActiveState,
  type PullRequestPublishability,
} from "@otomat/domain";
import { initialPublicationMode, pullRequestConnectionModel } from "@web/components/runs/pr/model";
import {
  publicationModel,
  type PublicationModelInput,
} from "@web/components/runs/pr/publication-model";
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

/** The pairing the daemon answers with: the row and the operation projected from it. */
function published(
  row: PullRequestContract,
  failedPhase: PullRequestPublicationActiveState | null = null,
): Partial<PublicationModelInput> {
  return {
    pullRequest: row,
    operation: projectPullRequestPublicationOperation(row.id, {
      publication_status: row.publication_status,
      failed_phase: failedPhase,
      error_code: row.error_code,
      error_message: row.error_message,
      updated_at: "2026-08-20T09:00:00.000Z",
    }),
  };
}

describe("publicationModel", () => {
  const model = (overrides: Partial<PublicationModelInput> = {}) =>
    publicationModel({
      pullRequest: null,
      operation: null,
      publishability: PUBLISHABLE,
      connected: true,
      hasDraftChanges: false,
      mode: "ready",
      ...overrides,
    });

  it("offers creation on a workspace with a publishable diff, whatever its run did", () => {
    expect(model()).toMatchObject({
      actionLabel: "Create PR ready for review",
      actionDisabled: false,
      stateLabel: "Ready to publish",
    });
  });

  it("names the draft publication when the operator chose it", () => {
    expect(model({ mode: "draft" })).toMatchObject({ actionLabel: "Create draft PR" });
  });

  it("blocks on the technical reason rather than on the run's state", () => {
    const blocked: PullRequestPublishability = {
      ...PUBLISHABLE,
      blocker: { code: "diff_empty", message: "The workspace carries no change." },
    };

    expect(model({ publishability: blocked })).toMatchObject({
      actionDisabled: true,
      stateLabel: "Cannot publish",
    });
  });

  it("waits for a connection before offering to publish", () => {
    expect(model({ connected: false })).toMatchObject({
      actionDisabled: true,
      stateLabel: "Not connected",
    });
  });

  it.each([
    ["generating", "Writing metadata"],
    ["committing", "Committing the workspace"],
    ["pushing", "Pushing the branch"],
    ["creating", "Creating the pull request"],
  ] as const)("names the phase the daemon is in for %s", (status, label) => {
    expect(model(published(pullRequest({ publication_status: status })))).toMatchObject({
      actionLabel: `${label}…`,
      actionPending: true,
      stateLabel: label,
    });
  });

  it("offers Update PR details only for edited details", () => {
    const row = pullRequest({
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
    });

    expect(model(published(row))).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: true,
      stateLabel: "Details published",
    });
    expect(model({ ...published(row), hasDraftChanges: true })).toMatchObject({
      actionLabel: "Update PR details",
      actionDisabled: false,
      stateLabel: "Unsaved details",
    });
  });

  it("keeps a failed creation retryable", () => {
    expect(
      model(
        published(pullRequest({ publication_status: "failed", error_code: "github_push_failed" })),
      ),
    ).toMatchObject({ actionDisabled: false, stateLabel: "Creation failed" });
  });

  it("offers an explicit retry for a publication a stopped daemon left behind", () => {
    expect(
      model(
        published(
          pullRequest({
            publication_status: "failed",
            error_code: PUBLICATION_INTERRUPTED_CODE,
            error_message: "The GitHub publication stopped while pushing the branch.",
          }),
          "pushing",
        ),
      ),
    ).toMatchObject({
      actionLabel: "Retry publication",
      actionDisabled: false,
      stateLabel: "Publication interrupted",
    });
  });

  it.each(["merged", "closed"] as const)("makes a %s PR terminal", (status) => {
    expect(
      model(
        published(
          pullRequest({
            number: 42,
            url: "https://github.com/acme/otomat/pull/42",
            status,
            publication_status: "created",
          }),
        ),
      ),
    ).toMatchObject({ actionDisabled: true, stateLabel: `PR ${status}` });
  });
});
