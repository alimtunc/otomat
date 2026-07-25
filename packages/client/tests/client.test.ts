import { expect, it, vi } from "vitest";

import { DaemonRequestError } from "#client/client/http";
import { createDaemonClient } from "#client/client/index";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
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
  let captured: { method?: string; body?: unknown } = {};
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
      send_message: true,
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
    },
    availability: { status: "unavailable", reason: "binary_not_found" },
    provider_options: [],
  };
  const fetchMock: typeof fetch = async () => jsonResponse([descriptor]);
  const client = createDaemonClient({ fetch: fetchMock });
  const runtimes = await client.listRuntimes();
  expect(runtimes).toEqual([descriptor]);
});

it("throws DaemonRequestError on a non-2xx response", async () => {
  const fetchMock: typeof fetch = async () => jsonResponse({ error: "run_not_found" }, 404);
  const client = createDaemonClient({ fetch: fetchMock });
  await expect(client.getRun("missing")).rejects.toBeInstanceOf(DaemonRequestError);
});

it("posts a start-run request body", async () => {
  let captured: { method?: string; body?: unknown } = {};
  const fetchMock: typeof fetch = async (_input, init) => {
    captured = { method: init?.method, body: init?.body };
    return jsonResponse(RUN, 201);
  };
  const client = createDaemonClient({ fetch: fetchMock });
  const result = await client.startRun({ prompt: "go" });
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ prompt: "go" });
  expect(result.id).toBe("run-1");
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

it("posts a follow-up prompt to the run's follow-up endpoint", async () => {
  let calledUrl = "";
  let captured: { method?: string; body?: unknown } = {};
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    captured = { method: init?.method, body: init?.body };
    return jsonResponse(RUN);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.followUpRun("run-1", { prompt: "keep going" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/follow-up");
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ prompt: "keep going" });
  expect(result.id).toBe("run-1");
});

it("posts abort and parses the returned run detail", async () => {
  let calledUrl = "";
  const detail = {
    run: { ...RUN, status: "canceled" },
    steps: [],
    sessions: [],
    compete_groups: [],
    worktree_path: null,
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
  line: 12,
  diff_sha: "sha-1",
  body: "Rename this.",
  status: "open",
  hunk_snapshot: "@@ -1 +1 @@",
  fix_requested_at: null,
};

it("fetches and parses the run diff (null diff allowed, never fabricated)", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({
      run_id: "run-1",
      computed_at: "2026-07-05T00:00:00.000Z",
      diff: null,
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.getRunDiff("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/diff");
  expect(result.diff).toBeNull();
});

it("fetches candidate evidence and posts an explicit compete winner", async () => {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const detail = {
    run: { ...RUN, status: "running" },
    steps: [],
    sessions: [],
    compete_groups: [],
    worktree_path: null,
  };
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: init?.body });
    if (init?.method === "POST") return jsonResponse(detail);
    return jsonResponse({
      run_id: "run-1",
      computed_at: "2026-07-05T00:00:00.000Z",
      diff: null,
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
      review: { id: "rv1", run_id: "run-1", status: "in_review" },
      comments: [COMMENT],
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const review = await client.getRunReview("run-1");
  expect(review.review?.status).toBe("in_review");
  expect(review.comments[0].diff_sha).toBe("sha-1");

  const created = await client.addReviewComment("run-1", {
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
  expect(created.id).toBe("c1");
  expect(urls).toEqual([
    "http://localhost:4319/api/runs/run-1/review",
    "http://localhost:4319/api/runs/run-1/review/comments",
  ]);
  expect(body).toEqual({
    file_path: "src/thing.ts",
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
    return jsonResponse({ ...RUN, status: "running" });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.requestFix("run-1", { comment_ids: ["c1", "c2"] });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/review/fix");
  expect(body).toEqual({ comment_ids: ["c1", "c2"] });
  expect(result.status).toBe("running");
});

it("reads connection state and starts delegated GitHub login", async () => {
  const urls: string[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    urls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return jsonResponse({
      status: init?.method === "POST" ? "connecting" : "connected",
      login: init?.method === "POST" ? null : "octocat",
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

it("reads and publishes the run pull request", async () => {
  const PR = {
    id: "pr1",
    run_id: "run-1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "First slice",
    body: null,
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    has_unpublished_changes: false,
  };
  let lastBody: unknown;
  const fetchMock: typeof fetch = async (_input, init) => {
    if (init?.method === "POST") {
      lastBody = JSON.parse(String(init.body));
      return jsonResponse({ pull_request: PR }, 201);
    }
    return jsonResponse({ pull_request: null });
  };
  const client = createDaemonClient({ fetch: fetchMock });

  expect((await client.getPullRequest("run-1")).pull_request).toBeNull();

  const prepared = await client.preparePullRequest("run-1", { title: "First slice", body: "" });
  expect(prepared.pull_request?.publication_status).toBe("not_configured");
  expect(lastBody).toEqual({ title: "First slice", body: "" });
});

it("registers a repository and parses the project + repository pair", async () => {
  const PROJECT = { id: "p-new", name: "otomat", root_path: "/tmp/otomat" };
  const REPOSITORY = {
    id: "r-new",
    project_id: "p-new",
    name: "otomat",
    remote_url: null,
    default_branch: "main",
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
  const fetchMock: typeof fetch = async () =>
    jsonResponse({ error: "head_detached", message: "The repository's HEAD is detached." }, 400);
  const client = createDaemonClient({ fetch: fetchMock });

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
      status: "connected",
      workspace_id: "workspace-1",
      workspace_name: "Otomat",
      user_name: "Alim",
      error_code: null,
      error_message: null,
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const connection = await client.connectLinear({ api_key: "lin_api_secret" });

  expect(calls).toEqual([
    {
      url: "http://localhost:4319/api/linear/connect",
      method: "POST",
      body: { api_key: "lin_api_secret" },
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
