import { rmSync } from "node:fs";

import { insertAgentProfile, type Db } from "@otomat/db";
import type {
  LinearSyncStatusContract,
  ProjectHealthCheck,
  ProjectHealthReport,
} from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { json, makeApiApp, request } from "#test-support/api";
import { anchorProjectRoot, seedRepository, setupTestDb, type TestDb } from "#test-support/db";
import { setupTestRepo, type TestRepo } from "#test-support/git";
import { CONNECTED_GITHUB, DISCONNECTED_GITHUB, stubGitHubService } from "#test-support/github";
import { stubLinearService } from "#test-support/linear";

const CONNECTED_LINEAR = {
  id: "linear-default",
  label: "Linear",
  workspace_id: "w1",
  workspace_name: "Acme",
  user_name: "Ada",
  status: "connected",
  error_code: null,
  error_message: null,
} satisfies NonNullable<LinearSyncStatusContract["connection"]>;

const MAPPED_LINEAR: LinearSyncStatusContract = {
  project_id: "p1",
  sources: 1,
  connection: CONNECTED_LINEAR,
  running: false,
  last_synced_at: "2026-09-09T10:00:00.000Z",
  last_result: null,
  last_error: null,
};

function healthyDeps(syncStatus: LinearSyncStatusContract = MAPPED_LINEAR) {
  return {
    github: stubGitHubService({ connection: async () => CONNECTED_GITHUB }),
    linear: stubLinearService({ syncStatus: () => syncStatus }),
  };
}

async function readHealth(
  t: TestDb,
  overrides: Parameters<typeof makeApiApp>[1] = healthyDeps(),
  projectId = "p1",
): Promise<ProjectHealthReport> {
  const response = await request(makeApiApp(t, overrides), `/api/projects/${projectId}/health`);
  expect(response.status).toBe(200);
  return json<ProjectHealthReport>(response);
}

function check(report: ProjectHealthReport, id: ProjectHealthCheck["id"]): ProjectHealthCheck {
  const found = report.checks.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no ${id} check in the report`);
  return found;
}

function attachRepository(db: Db, repo: TestRepo): void {
  seedRepository(db, repo.defaultBranch);
  anchorProjectRoot(db, repo.root);
}

describe("GET /api/projects/:id/health", () => {
  let t: TestDb;
  let repo: TestRepo;

  beforeEach(() => {
    t = setupTestDb("otomat-project-health-");
    repo = setupTestRepo();
  });

  afterEach(() => {
    repo.cleanup();
    t.cleanup();
  });

  it("answers 404 for a project this host does not hold", async () => {
    const response = await request(makeApiApp(t, healthyDeps()), "/api/projects/nope/health");
    expect(response.status).toBe(404);
  });

  it("reports Ready for a project whose host is fully configured", async () => {
    attachRepository(t.db, repo);

    const report = await readHealth(t);

    expect(report.project_id).toBe("p1");
    expect(report.status).toBe("ready");
    expect(report.checks.map((entry) => entry.id)).toStrictEqual([
      "daemon",
      "repository",
      "git_remote",
      "worktrees_root",
      "linear",
      "github",
      "runtimes",
      "agents",
    ]);
    expect(report.checks.every((entry) => entry.status === "ready")).toBe(true);
    expect(Date.parse(report.checked_at)).not.toBeNaN();
  });

  it("keeps the other checks when one of them fails", async () => {
    attachRepository(t.db, repo);

    const report = await readHealth(t, {
      github: stubGitHubService({ connection: async () => DISCONNECTED_GITHUB }),
      linear: stubLinearService({ syncStatus: () => MAPPED_LINEAR }),
    });

    expect(report.status).toBe("error");
    expect(check(report, "github")).toMatchObject({
      status: "error",
      remediation: expect.stringContaining("Connect GitHub"),
    });
    expect(check(report, "repository").status).toBe("ready");
    expect(check(report, "git_remote").status).toBe("ready");
  });

  it("names the repository as the blocker when the project has none here", async () => {
    const report = await readHealth(t);

    expect(report.status).toBe("error");
    expect(check(report, "repository")).toMatchObject({
      status: "error",
      remediation: "Register the project's repository path on this host.",
    });
    expect(check(report, "git_remote").status).toBe("unknown");
  });

  it("reports a repository path that left this host", async () => {
    attachRepository(t.db, repo);
    anchorProjectRoot(t.db, `${repo.root}-gone`);

    const report = await readHealth(t);

    expect(check(report, "repository")).toMatchObject({
      status: "error",
      message: expect.stringContaining("no longer a git repository root"),
    });
    expect(check(report, "git_remote").status).toBe("unknown");
  });

  it("names a missing upstream as one instead of as a network failure", async () => {
    attachRepository(t.db, repo);
    repo.git("remote", "add", "second", repo.git("remote", "get-url", "origin").trim());
    repo.git("config", "--unset", `branch.${repo.defaultBranch}.remote`);

    const remote = check(await readHealth(t), "git_remote");

    expect(remote.status).toBe("error");
    expect(remote.message).toContain("tracks no remote");
    expect(remote.remediation).toContain("Set the upstream");
  });

  it("keeps every other check when one of them throws", async () => {
    attachRepository(t.db, repo);

    const report = await readHealth(t, {
      github: stubGitHubService({
        connection: () => Promise.reject(new Error("gh exploded")),
      }),
      linear: stubLinearService({ syncStatus: () => MAPPED_LINEAR }),
    });

    expect(check(report, "github")).toMatchObject({
      status: "unknown",
      message: "This check could not run on this host.",
    });
    expect(check(report, "github").message).not.toContain("exploded");
    expect(check(report, "repository").status).toBe("ready");
    expect(report.status).toBe("unknown");
  });

  it("reports an unreachable remote without forwarding its output", async () => {
    attachRepository(t.db, repo);
    rmSync(repo.git("remote", "get-url", "origin").trim(), { recursive: true, force: true });

    const report = await readHealth(t);

    const remote = check(report, "git_remote");
    expect(remote.status).toBe("error");
    expect(remote.message).toBe('"main" could not be read from "origin" on this host.');
    expect(remote.remediation).toContain("network access");
  });

  it("refuses a repository with no remote at all, which no default launch can fork from", async () => {
    const local = setupTestRepo({ withoutRemote: true });
    attachRepository(t.db, local);
    try {
      const report = await readHealth(t);
      expect(check(report, "git_remote")).toMatchObject({
        status: "error",
        message: expect.stringContaining("has no git remote"),
      });
      expect(report.status).toBe("error");
    } finally {
      local.cleanup();
    }
  });

  it("reports an invalid Linear integration and an unmapped one apart", async () => {
    attachRepository(t.db, repo);

    const refused = await readHealth(t, {
      ...healthyDeps({
        ...MAPPED_LINEAR,
        connection: { ...CONNECTED_LINEAR, status: "failed", error_message: "Access refused" },
      }),
    });
    expect(check(refused, "linear")).toMatchObject({ status: "error" });
    expect(check(refused, "linear").message).toContain("Access refused");

    const unmapped = await readHealth(
      t,
      healthyDeps({ ...MAPPED_LINEAR, sources: 0, connection: null }),
    );
    expect(check(unmapped, "linear")).toMatchObject({ status: "warning" });
  });

  it("reports an agent profile whose runtime this host cannot provide", async () => {
    attachRepository(t.db, repo);
    insertAgentProfile(t.db, {
      id: "prof-ghost",
      name: "Ghost",
      project_id: null,
      runtime: "ghost",
      model: null,
      guidance: null,
      options_json: {},
      skill_ids_json: [],
    });

    const report = await readHealth(t);

    expect(report.status).toBe("error");
    expect(check(report, "agents")).toMatchObject({
      status: "error",
      message: expect.stringContaining("Ghost"),
    });
  });
});
