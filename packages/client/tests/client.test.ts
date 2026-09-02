import { expect, it, vi } from "vitest";

import { DaemonRequestError } from "#client/client/http";
import { createDaemonClient } from "#client/client/index";

import { jsonResponse } from "./support/response.js";

interface CapturedRequest {
  url?: string;
  method?: string;
  body?: unknown;
}

const ISSUE = {
  id: "issue-1",
  project_id: "project-1",
  title: "First",
  body: null,
  status: "ready",
  execution: { state: "none", run_id: null },
  source: "local",
  source_external_id: null,
  source_identifier: null,
  source_url: null,
  synced_at: null,
  source_assignee_name: null,
  source_priority: null,
  source_labels: null,
  source_state_name: null,
  source_state_color: null,
};

const RUN = {
  id: "run-1",
  issue_id: "issue-1",
  status: "running",
  branch: "b",
  plan_json: { version: 1, steps: [] },
  updated_at: "2026-07-25T10:00:00.000Z",
};

const TARGET_CONFIG = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  options: {},
  model: null,
  guidance: null,
  skills: [],
  sources: null,
  config_hash: "config-1",
};

const CONTRIBUTION = {
  id: "contribution-1",
  run_id: "run-1",
  step_run_id: "step-1",
  seq: 0,
  body: "keep going",
  status: "queued",
  agent_session_id: null,
  target_agent_session_id: "session-1",
  target_config: TARGET_CONFIG,
  delivered_at: null,
  settled_at: null,
  attempts: 0,
  error: null,
  created_at: "2026-07-25T10:00:00.000Z",
};

it("parses a typed list response", async () => {
  const fetchMock: typeof fetch = vi.fn(async () => jsonResponse([ISSUE]));
  const client = createDaemonClient({ fetch: fetchMock });
  const issues = await client.listIssues();
  expect(issues).toHaveLength(1);
  expect(issues[0].status).toBe("ready");
});

it("appends defined query params only", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse([]);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  await client.listRuns({ issueId: "issue-1" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs?issueId=issue-1");
});

it("posts a create-issue request and parses the created issue", async () => {
  let calledUrl = "";
  let captured: CapturedRequest = {};
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    captured = { method: init?.method, body: init?.body };
    return jsonResponse({ ...ISSUE, status: "backlog" }, 201);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const issue = await client.createIssue({ project_id: "project-1", title: "Manual" });
  expect(calledUrl).toBe("http://localhost:4319/api/issues");
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ project_id: "project-1", title: "Manual" });
  expect(issue.status).toBe("backlog");
});

it("parses the runtime catalog with kind and availability", async () => {
  const descriptor = {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      interactions: { status: "supported", kinds: ["permission"] },
      diff_hints: false,
      provider_limit: "deadline",
    },
    availability: { status: "unavailable", reason: "binary_not_found" },
  };
  const fetchMock: typeof fetch = async () => jsonResponse([descriptor]);
  const client = createDaemonClient({ fetch: fetchMock });
  const runtimes = await client.listRuntimes();
  expect(runtimes).toEqual([descriptor]);
});

it("throws DaemonRequestError on a non-2xx response", async () => {
  const client = createDaemonClient({
    fetch: async () => jsonResponse({ error: "run_not_found" }, 404),
  });
  await expect(client.getRun("missing")).rejects.toBeInstanceOf(DaemonRequestError);
});

it("posts a start-run request body and reads back the run with its wait, if any", async () => {
  let captured: CapturedRequest = {};
  const wait = {
    kind: "concurrency_limit",
    position: 1,
    active_sessions: 4,
    max_concurrent_sessions: 4,
  };
  const fetchMock: typeof fetch = async (_input, init) => {
    captured = { method: init?.method, body: init?.body };
    return jsonResponse({ run: { ...RUN, status: "queued" }, wait }, 201);
  };
  const client = createDaemonClient({ fetch: fetchMock });
  const result = await client.startRun({ prompt: "go" });
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ prompt: "go" });
  expect(result.run.id).toBe("run-1");
  expect(result.wait).toEqual(wait);
});

it("reads and writes this host's agent-session capacity", async () => {
  const capacity = { max_concurrent_sessions: 6, active_sessions: 1, waiting_sessions: 0 };
  let captured: CapturedRequest = {};
  const fetchMock: typeof fetch = async (input, init) => {
    captured = { url: String(input), method: init?.method, body: init?.body };
    return jsonResponse(capacity);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  expect(await client.agentCapacity()).toEqual(capacity);
  expect(captured.url).toBe("http://localhost:4319/api/settings/capacity");

  expect(await client.setAgentCapacity({ max_concurrent_sessions: 6 })).toEqual(capacity);
  expect(captured.method).toBe("PUT");
  expect(JSON.parse(String(captured.body))).toEqual({ max_concurrent_sessions: 6 });
});

it("posts resume to the run's resume endpoint", async () => {
  let calledUrl = "";
  let method = "";
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    method = String(init?.method);
    return jsonResponse(RUN);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.resumeRun("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/resume");
  expect(method).toBe("POST");
  expect(result.id).toBe("run-1");
});

it("posts a message to the run's contributions endpoint and parses its queued state", async () => {
  let calledUrl = "";
  let captured: CapturedRequest = {};
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    captured = { method: init?.method, body: init?.body };
    return jsonResponse(CONTRIBUTION, 201);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.createRunContribution("run-1", {
    step_run_id: "step-1",
    target_agent_session_id: "session-1",
    target_config_hash: "config-1",
    body: "keep going",
  });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/contributions");
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({
    step_run_id: "step-1",
    target_agent_session_id: "session-1",
    target_config_hash: "config-1",
    body: "keep going",
  });
  expect(result.status).toBe("queued");
  expect(result.delivered_at).toBeNull();
});

it("retries one contribution through its own endpoint", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({ ...CONTRIBUTION, status: "queued", attempts: 1 });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.retryRunContribution("run-1", "contribution-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/contributions/contribution-1/retry");
  expect(result.attempts).toBe(1);
});

it("cancels one contribution through its own endpoint", async () => {
  let calledUrl = "";
  let method = "";
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    method = String(init?.method);
    return jsonResponse({
      ...CONTRIBUTION,
      status: "canceled",
      settled_at: "2026-07-25T10:01:00.000Z",
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.cancelRunContribution("run-1", "contribution-1");
  expect(calledUrl).toBe(
    "http://localhost:4319/api/runs/run-1/contributions/contribution-1/cancel",
  );
  expect(method).toBe("POST");
  expect(result.status).toBe("canceled");
});

it("lists a run's contributions in send order", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({
      run_id: "run-1",
      contributions: [CONTRIBUTION, { ...CONTRIBUTION, id: "contribution-2", seq: 1 }],
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.listRunContributions("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/contributions");
  expect(result.contributions.map((entry) => entry.seq)).toEqual([0, 1]);
});

it("reads what abandoning a workspace would leave behind, then confirms it", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const summary = {
    run_id: "run-1",
    branch: "otomat/run/run-1",
    base_branch: "main",
    worktree_path: "/tmp/wt",
    commits: [{ sha: "abc1234", subject: "Wire the thing" }],
    commit_count: 1,
    uncommitted_files: 2,
    changed_files: 3,
    additions: 40,
    deletions: 4,
    pull_request: null,
    blocker: null,
  };
  const fetchMock: typeof fetch = async (input, init) => {
    const call: CapturedRequest = { url: String(input) };
    if (init?.method) call.method = init.method;
    calls.push(call);
    return jsonResponse(init?.method === "POST" ? { ...RUN, status: "canceled" } : summary);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const read = await client.getRunWorkspace("run-1");
  const abandoned = await client.abandonRunWorkspace("run-1");

  expect(calls[0]?.url).toBe("http://localhost:4319/api/runs/run-1/workspace");
  expect(calls[1]).toEqual({
    url: "http://localhost:4319/api/runs/run-1/abandon",
    method: "POST",
  });
  expect(read.commits).toHaveLength(1);
  expect(read.blocker).toBeNull();
  expect(abandoned.status).toBe("canceled");
});

it("posts abort and parses the returned run detail", async () => {
  let calledUrl = "";
  const detail = {
    run: { ...RUN, status: "canceled" },
    steps: [],
    sessions: [],
    compete_groups: [],
    worktree_path: null,
    base_branch: null,
  };
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse(detail);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.abortRun("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/abort");
  expect(result.run.status).toBe("canceled");
});

const COMMENT = {
  id: "c1",
  review_id: "rv1",
  file_path: "src/thing.ts",
  side: "new",
  start_line: null,
  line: 12,
  diff_sha: "sha-1",
  body: "Rename this.",
  status: "open",
  destination: "agent",
  publication_status: "local",
  publication_error: null,
  external_url: null,
  suggestion: null,
  suggestion_original: null,
  hunk_snapshot: "@@ -1 +1 @@",
  fix_requested_at: null,
  fixed_by_session_id: null,
};

const REVIEWED_FILE = {
  id: "rf1",
  review_id: "rv1",
  file_path: "src/thing.ts",
  diff_sha: "sha-1",
  reviewed: true,
  sync_status: "synced",
  sync_error: null,
};

it("fetches and parses the run diff (null diff allowed, never fabricated)", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({
      subject_id: "run-1",
      computed_at: "2026-07-05T00:00:00.000Z",
      diff: null,
      scope: { kind: "branch", branch: "otomat/run/x", base_ref: "main" },
      unavailable: "This run has no worktree, so there is no current diff to show.",
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.getReviewDiff({ kind: "run", id: "run-1" }, { kind: "branch" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/diff");
  expect(result.diff).toBeNull();
});

it("reads the newest ledger page, then the one above it by cursor", async () => {
  const urls: string[] = [];
  const fetchMock: typeof fetch = async (input) => {
    urls.push(String(input));
    return jsonResponse({ run_id: "run-1", events: [], older_cursor: 40 });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const newest = await client.getRunEventWindow("run-1");
  await client.getRunEventWindow("run-1", { before: newest.older_cursor ?? 0, limit: 20 });

  expect(urls).toEqual([
    "http://localhost:4319/api/runs/run-1/events/window",
    "http://localhost:4319/api/runs/run-1/events/window?before=40&limit=20",
  ]);
});

it("fetches candidate evidence and posts an explicit compete winner", async () => {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const detail = {
    run: { ...RUN, status: "running" },
    steps: [],
    sessions: [],
    compete_groups: [],
    worktree_path: null,
    base_branch: null,
  };
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: init?.body });
    if (init?.method === "POST") return jsonResponse(detail);
    return jsonResponse({
      subject_id: "run-1",
      computed_at: "2026-07-05T00:00:00.000Z",
      diff: null,
      scope: { kind: "branch", branch: "otomat/run/x", base_ref: "main" },
      unavailable: "This run has no worktree, so there is no current diff to show.",
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  await client.getCompeteCandidateDiff("run-1", "group/1", "candidate 1");
  const selected = await client.selectCompeteWinner("run-1", "group/1", {
    step_run_id: "candidate 1",
  });

  expect(calls[0]?.url).toBe(
    "http://localhost:4319/api/runs/run-1/compete-groups/group%2F1/candidates/candidate%201/diff",
  );
  expect(calls[1]?.url).toBe(
    "http://localhost:4319/api/runs/run-1/compete-groups/group%2F1/winner",
  );
  expect(JSON.parse(String(calls[1]?.body))).toEqual({ step_run_id: "candidate 1" });
  expect(selected.run.status).toBe("running");
});

it("fetches the review surface and posts a pinned comment", async () => {
  const urls: string[] = [];
  let body: unknown;
  const fetchMock: typeof fetch = async (input, init) => {
    urls.push(String(input));
    if (init?.method === "POST") {
      body = JSON.parse(String(init.body));
      return jsonResponse(COMMENT, 201);
    }
    return jsonResponse({
      review: { id: "rv1", subject_id: "run-1", status: "in_review" },
      comments: [COMMENT],
      reviewed_files: [REVIEWED_FILE],
      fix_authority: { kind: "otomat", reason: "Otomat owns this branch." },
      destinations: { pr_review: false, reason: "This run has no pull request yet." },
      submission: { events: [], reason: "This run has no pull request yet." },
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const review = await client.getReviewDetail({ kind: "run", id: "run-1" });
  expect(review.review?.status).toBe("in_review");
  expect(review.comments[0].diff_sha).toBe("sha-1");
  expect(review.reviewed_files[0]).toMatchObject({ file_path: "src/thing.ts", reviewed: true });

  const created = await client.addReviewComment(
    { kind: "run", id: "run-1" },
    {
      file_path: "src/thing.ts",
      side: "new",
      line: 12,
      diff_sha: "sha-1",
      destination: "agent",
      body: "Rename this.",
    },
  );
  expect(created.id).toBe("c1");
  expect(urls).toEqual([
    "http://localhost:4319/api/runs/run-1/review",
    "http://localhost:4319/api/runs/run-1/review/comments",
  ]);
  expect(body).toEqual({
    file_path: "src/thing.ts",
    side: "new",
    destination: "agent",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
});

it("posts a fix request with the selected comment ids", async () => {
  let calledUrl = "";
  let body: unknown;
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    body = JSON.parse(String(init?.body));
    return jsonResponse({ run: { ...RUN, status: "running" }, step_run_id: "fix-step" });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.requestFix("run-1", { profile_id: "profile-1" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/review/fix");
  expect(body).toEqual({ profile_id: "profile-1" });
  expect(result.run.status).toBe("running");
  expect(result.step_run_id).toBe("fix-step");
});

it("reads connection state and starts delegated GitHub login", async () => {
  const urls: string[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    urls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return jsonResponse({
      status: init?.method === "POST" ? "connecting" : "connected",
      login: init?.method === "POST" ? null : "octocat",
      device_authorization: null,
      error_code: null,
      error_message: null,
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  expect(await client.getGitHubConnection()).toMatchObject({
    status: "connected",
    login: "octocat",
  });
  expect(await client.connectGitHub()).toMatchObject({ status: "connecting" });
  expect(urls).toEqual([
    "GET http://localhost:4319/api/github/connection",
    "POST http://localhost:4319/api/github/connect",
  ]);
});

const PUBLISHABILITY = {
  blocker: null,
  repository: "acme/otomat",
  base_ref: "main",
  head_ref: "otomat/run/run-1",
  changed_files: 1,
  additions: 2,
  deletions: 0,
  dirty: false,
};

it("reads and publishes the run pull request", async () => {
  const PR = {
    id: "pr1",
    issue_id: "issue-1",
    run_id: "run-1",
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
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "First slice",
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
  };
  let lastBody: unknown;
  const fetchMock: typeof fetch = async (_input, init) => {
    if (init?.method === "POST") {
      lastBody = JSON.parse(String(init.body));
      return jsonResponse(
        { pull_request: PR, sync: null, publishability: PUBLISHABILITY, operation: null },
        202,
      );
    }
    return jsonResponse({
      pull_request: null,
      sync: null,
      publishability: PUBLISHABILITY,
      operation: null,
    });
  };
  const client = createDaemonClient({ fetch: fetchMock });

  expect((await client.getPullRequest("run-1")).pull_request).toBeNull();

  const subject = { type: "feat" as const, scope: null, summary: "add the first slice" };
  const details = { subject, body: "" };
  const accepted = await client.publishPullRequest("run-1", { mode: "draft", details });
  expect(accepted.pull_request?.publication_status).toBe("not_configured");
  expect(accepted.publishability.blocker).toBeNull();
  expect(lastBody).toEqual({ mode: "draft", details });
});

it("generates the pull request metadata without publishing anything", async () => {
  const PROPOSAL = {
    subject: { type: "feat", scope: "pr", summary: "publish in one action" },
    body: "Details\n\nFixes OTO-81",
    branch: "feat/compact-pr",
    commit_body: null,
    generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
  };
  const urls: string[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    urls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return jsonResponse(PROPOSAL);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  expect(await client.generatePullRequestMetadata("run-1")).toEqual(PROPOSAL);
  expect(urls).toEqual(["POST http://localhost:4319/api/runs/run-1/pr/generate"]);
});

it("pushes the run's commits and parses the published comparison", async () => {
  const SYNC = {
    state: "in_sync",
    dirty: true,
    local_head_sha: "a".repeat(40),
    remote_head_sha: "a".repeat(40),
    ahead: [],
    replaced: [],
  };
  let lastBody: unknown;
  const fetchMock: typeof fetch = async (_input, init) => {
    lastBody = JSON.parse(String(init?.body));
    return jsonResponse({
      pull_request: null,
      sync: SYNC,
      publishability: PUBLISHABILITY,
      operation: null,
    });
  };
  const client = createDaemonClient({ fetch: fetchMock });

  const pushed = await client.pushPullRequestCommits("run-1", {
    expected_remote_sha: "b".repeat(40),
  });

  expect(pushed.sync).toEqual(SYNC);
  expect(lastBody).toEqual({ expected_remote_sha: "b".repeat(40) });
});

it("registers a repository and parses the project + repository pair", async () => {
  const PROJECT = { id: "p-new", name: "otomat", root_path: "/tmp/otomat" };
  const REPOSITORY = {
    id: "r-new",
    project_id: "p-new",
    name: "otomat",
    remote_url: null,
    default_branch: "main",
    init_commands: [],
    available: true,
  };
  let calledUrl = "";
  let lastBody: unknown;
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    lastBody = JSON.parse(String(init?.body));
    return jsonResponse({ project: PROJECT, repository: REPOSITORY }, 201);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const result = await client.registerRepository({ path: "/tmp/otomat" });
  expect(calledUrl).toBe("http://localhost:4319/api/repositories");
  expect(lastBody).toEqual({ path: "/tmp/otomat" });
  expect(result.repository.default_branch).toBe("main");
});

it("surfaces the daemon's error payload on a refused registration", async () => {
  const client = createDaemonClient({
    fetch: async () =>
      jsonResponse({ error: "head_detached", message: "The repository's HEAD is detached." }, 400),
  });

  const error = await client.registerRepository({ path: "/tmp/x" }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DaemonRequestError);
  if (!(error instanceof DaemonRequestError)) throw new Error("expected DaemonRequestError");
  expect(error.status).toBe(400);
  expect(error.body).toEqual({
    error: "head_detached",
    message: "The repository's HEAD is detached.",
  });
});

it("passes the projectId filter to the runs list", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse([]);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  await client.listRuns({ projectId: "p1" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs?projectId=p1");
});

it("posts the Linear key to the write-only connect endpoint", async () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return jsonResponse({
      id: "c-otomat",
      label: "Otomat",
      workspace_id: "workspace-1",
      workspace_name: "Otomat",
      user_name: "Alim",
      status: "connected",
      error_code: null,
      error_message: null,
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const connection = await client.connectLinear({
    id: "c-otomat",
    label: "Otomat",
    api_key: "lin_api_secret",
  });

  expect(calls).toEqual([
    {
      url: "http://localhost:4319/api/linear/connections",
      method: "POST",
      body: { id: "c-otomat", label: "Otomat", api_key: "lin_api_secret" },
    },
  ]);
  expect(JSON.stringify(connection)).not.toContain("lin_api_secret");
  expect(connection.workspace_name).toBe("Otomat");
});

it("reads mapped issue sources and triggers a sync", async () => {
  const urls: string[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/sources")) {
      return jsonResponse([
        {
          id: "src-1",
          project_id: "p1",
          connection_id: "c-otomat",
          source: "linear",
          external_team_id: "team-1",
          external_team_key: "OTO",
          external_team_name: "Otomat",
          external_project_id: "",
          external_project_name: "",
          last_synced_at: null,
        },
      ]);
    }
    return jsonResponse({
      results: [
        { source_id: "src-1", imported: 2, updated: 1, synced_at: "2026-07-20T12:00:00.000Z" },
      ],
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  expect((await client.listIssueSources())[0]).toMatchObject({ external_team_key: "OTO" });
  expect((await client.syncLinear()).results[0]).toMatchObject({ imported: 2, updated: 1 });
  expect(urls).toEqual([
    "GET http://localhost:4319/api/linear/sources",
    "POST http://localhost:4319/api/linear/sync",
  ]);
});

it("reads the host's activity snapshot and validates its buckets", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({
      activities: [
        {
          kind: "pull_request_publication",
          id: "publication:pr-1",
          bucket: "attention",
          operation: {
            id: "pr-1",
            kind: "pull_request_publication",
            state: "failed",
            phases: [{ key: "push", label: "Pushing the branch", state: "failed" }],
            error: { code: "github_push_failed", message: "gh refused" },
            retryable: true,
            updated_at: "2026-07-25T10:00:00.000Z",
          },
          project: { id: "project-1", name: "Otomat" },
          issue: { id: "issue-1", identifier: "ABC-1", title: "Ship it" },
          run_id: "run-1",
          phase: "Pushing the branch",
          updated_at: "2026-07-25T10:00:00.000Z",
        },
      ],
      observed_at: "2026-07-25T10:00:01.000Z",
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const snapshot = await client.listActivity();

  expect(calledUrl).toBe("http://localhost:4319/api/activity");
  expect(snapshot.activities[0]).toMatchObject({ bucket: "attention", run_id: "run-1" });
});
