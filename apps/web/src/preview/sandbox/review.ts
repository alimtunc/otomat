import {
  projectPullRequestPublicationOperation,
  type DiffFileBlobsResponse,
  type PullRequestContract,
  type PullRequestDetail,
  type PullRequestInbox,
  type PullRequestOverview,
  type ReviewDetail,
  type ReviewDiffResponse,
} from "@otomat/domain";
import { branchOf, SANDBOX_REVIEW_RUN_ID } from "@web/preview/sandbox/runs";
import { SANDBOX_NOW, SANDBOX_PROJECT_ID } from "@web/preview/sandbox/workspace";

const FILE_PATH = "apps/web/src/components/runs/review/comment-anchor.ts";

const PATCH = [
  `diff --git a/${FILE_PATH} b/${FILE_PATH}`,
  "index 1a2b3c4..5d6e7f8 100644",
  `--- a/${FILE_PATH}`,
  `+++ b/${FILE_PATH}`,
  "@@ -1,6 +1,9 @@",
  ' import type { DiffFileContract } from "@otomat/domain";',
  " ",
  "-export function anchor(file: DiffFileContract, line: number) {",
  "-  return { path: file.path, line };",
  "+export function anchor(file: DiffFileContract, line: number, startLine: number | null) {",
  "+  return { path: file.path, sha: file.sha, start_line: startLine, line };",
  " }",
  "+",
  "+/** A stale anchor is refused, never silently re-pointed at the line that now sits there. */",
  "+export const ANCHOR_VERSION = 2;",
  "",
].join("\n");

const DIFF_SHA = "b4c1f0a7d92e5638ac0f1b7e4d2a9c53f08b6e17";

export const SANDBOX_DIFF: ReviewDiffResponse = {
  subject_id: SANDBOX_REVIEW_RUN_ID,
  computed_at: SANDBOX_NOW,
  diff: {
    base: "1c4d7e9a2b6f08351d4e7a9c2b6f08351d4e7a9c",
    head: "7f2b91c4e0a53d86b1f4c7e0a53d86b1f4c7e0a5",
    files: [
      {
        path: FILE_PATH,
        old_path: null,
        status: "modified",
        additions: 5,
        deletions: 2,
        binary: false,
        patch: PATCH,
        sha: DIFF_SHA,
      },
    ],
    additions: 5,
    deletions: 2,
    sha: DIFF_SHA,
  },
  scope: { kind: "branch", branch: "otomat/run/sandbox", base_ref: "main" },
  unavailable: null,
};

export const SANDBOX_DIFF_BLOBS: DiffFileBlobsResponse = {
  base_content: [
    'import type { DiffFileContract } from "@otomat/domain";',
    "",
    "export function anchor(file: DiffFileContract, line: number) {",
    "  return { path: file.path, line };",
    "}",
    "",
  ].join("\n"),
  head_content: [
    'import type { DiffFileContract } from "@otomat/domain";',
    "",
    "export function anchor(file: DiffFileContract, line: number, startLine: number | null) {",
    "  return { path: file.path, sha: file.sha, start_line: startLine, line };",
    "}",
    "",
    "/** A stale anchor is refused, never silently re-pointed at the line that now sits there. */",
    "export const ANCHOR_VERSION = 2;",
    "",
  ].join("\n"),
};

export const SANDBOX_REVIEW: ReviewDetail = {
  review: { id: "sandbox-review-1", subject_id: SANDBOX_REVIEW_RUN_ID, status: "in_review" },
  comments: [
    {
      id: "sandbox-comment-1",
      review_id: "sandbox-review-1",
      file_path: FILE_PATH,
      side: "new",
      start_line: null,
      line: 9,
      diff_sha: DIFF_SHA,
      body: "Name the version constant after what it pins, not after the file.",
      status: "open",
      destination: "agent",
      publication_status: "local",
      publication_error: null,
      external_url: null,
      suggestion: null,
      suggestion_original: null,
      hunk_snapshot: PATCH,
      fix_requested_at: null,
      fixed_by_session_id: null,
    },
  ],
  reviewed_files: [
    {
      id: "sandbox-reviewed-1",
      review_id: "sandbox-review-1",
      file_path: FILE_PATH,
      diff_sha: DIFF_SHA,
      reviewed: false,
      sync_status: "local",
      sync_error: null,
    },
  ],
  fix_authority: { kind: "otomat", reason: "Otomat opened this pull request." },
  destinations: { pr_review: false, reason: "The sandbox publishes nothing to GitHub." },
  submission: { events: [], reason: "The sandbox publishes nothing to GitHub." },
};

const HEAD_SHA = "9f2c41d6b8ae5730c1d4f0a2b6e8d3c5a7091b24";

const PULL_REQUEST: PullRequestContract = {
  id: "sandbox-pr-1",
  issue_id: "sandbox-issue-3",
  run_id: SANDBOX_REVIEW_RUN_ID,
  provider: "github",
  origin: "otomat",
  provenance: "otomat",
  author_login: "otomat-bot",
  review_decision: "review_required",
  checks_state: "passing",
  mergeable: "mergeable",
  requested_reviewers: [],
  provider_updated_at: SANDBOX_NOW,
  head_sha: HEAD_SHA,
  attachment: null,
  number: 412,
  url: "https://github.com/otomat/otomat/pull/412",
  status: "open",
  publication_status: "created",
  title: "feat(review): anchor comments to the diff sha",
  body: "Pins every review comment to the sha of the file it was written against.",
  head_ref: branchOf(SANDBOX_REVIEW_RUN_ID),
  base_ref: "main",
  commit_subject: "feat(review): anchor comments to the diff sha",
  commit_body: null,
  generator: null,
  published_head_sha: HEAD_SHA,
  published_diff_sha: DIFF_SHA,
  error_code: null,
  error_message: null,
};

export const SANDBOX_PULL_REQUESTS: PullRequestContract[] = [PULL_REQUEST];

export const SANDBOX_PULL_REQUEST_DETAIL: PullRequestDetail = {
  pull_request: PULL_REQUEST,
  operation: projectPullRequestPublicationOperation(PULL_REQUEST.id, {
    publication_status: PULL_REQUEST.publication_status,
    failed_phase: null,
    error_code: null,
    error_message: null,
    updated_at: SANDBOX_NOW,
  }),
  sync: null,
  publishability: {
    blocker: null,
    repository: "otomat/otomat",
    base_ref: "main",
    head_ref: PULL_REQUEST.head_ref,
    changed_files: 1,
    additions: 5,
    deletions: 2,
    dirty: false,
  },
};

export const SANDBOX_PULL_REQUEST_OVERVIEW: PullRequestOverview = {
  pull_request: PULL_REQUEST,
  issue: null,
  repository: "otomat/otomat",
  checks: [
    { name: "build", state: "passing", url: null },
    { name: "test", state: "passing", url: null },
  ],
  reviews: [{ author_login: "sandbox-operator", state: "commented", submitted_at: SANDBOX_NOW }],
  commits: 3,
  changed_files: 1,
  additions: 5,
  deletions: 2,
  behind_base: false,
  merge: {
    methods: [],
    blocker: "not_authorized",
    reason: "The sandbox merges nothing on GitHub.",
  },
};

export const SANDBOX_REVIEW_INBOX: PullRequestInbox = {
  project_id: SANDBOX_PROJECT_ID,
  viewer: { login: "sandbox-operator", teams_known: true },
  sync: { running: false, repositories: 1, last_synced_at: SANDBOX_NOW, last_error: null },
  entries: [
    {
      id: PULL_REQUEST.id,
      group: "needs_your_review",
      repository: "otomat/otomat",
      number: 412,
      title: PULL_REQUEST.title,
      url: PULL_REQUEST.url,
      author_login: "otomat-bot",
      status: "open",
      provenance: "otomat",
      review_decision: "review_required",
      checks_state: "passing",
      mergeable: "mergeable",
      head_ref: PULL_REQUEST.head_ref,
      base_ref: "main",
      updated_at: SANDBOX_NOW,
      run_id: SANDBOX_REVIEW_RUN_ID,
      issue: {
        id: "sandbox-issue-3",
        identifier: "OTO-303",
        title: "Anchor review comments to a sha",
        status: "reviewing",
        evidence: "attachment",
      },
      head_fetched: true,
    },
  ],
};
