import { describe, expect, it } from "vitest";

import {
  agentCapacitySchema,
  createIssueRequestSchema,
  createRunContributionRequestSchema,
  healthResponseSchema,
  registerRepositoryRequestSchema,
  repositoryRegistrationErrorSchema,
  runDetailSchema,
  runLaunchResponseSchema,
  runtimeAvailabilitySchema,
  runtimeDescriptorSchema,
  selectCompeteWinnerRequestSchema,
  startRunRequestSchema,
  updateAgentCapacityRequestSchema,
} from "#domain/contracts/api";

it("requires safe schema metadata on daemon health", () => {
  const health = healthResponseSchema.parse({
    status: "ok",
    name: "otomat-local-daemon",
    version: "0.1.0",
    build: "abc1234",
    started_at: "2026-07-23T10:00:00.000Z",
    db_path: "/tmp/otomat.db",
    schema: {
      migration_count: 10,
      latest_migration_at: 1_784_742_886_678,
      page_count: 42,
      page_size: 4096,
    },
  });

  expect(health.schema.migration_count).toBe(10);
  expect(
    healthResponseSchema.safeParse({
      status: "ok",
      name: "otomat-local-daemon",
      version: "0.1.0",
      started_at: "2026-07-23T10:00:00.000Z",
      db_path: "/tmp/otomat.db",
    }).success,
  ).toBe(false);
});

it("defaults a missing build to null so a pre-stamp daemon deploy still connects", () => {
  const health = healthResponseSchema.parse({
    status: "ok",
    name: "otomat-local-daemon",
    version: "0.1.0",
    started_at: "2026-07-23T10:00:00.000Z",
    db_path: "/tmp/otomat.db",
    schema: {
      migration_count: 10,
      latest_migration_at: null,
      page_count: 42,
      page_size: 4096,
    },
  });

  expect(health.build).toBeNull();
});

const RUN = {
  id: "run-1",
  issue_id: "i1",
  status: "running",
  branch: "otomat/run/run-1",
  plan_json: { version: 1, steps: [] },
  updated_at: "2026-07-25T10:00:00.000Z",
};

describe("runLaunchResponseSchema", () => {
  it("carries the durable run plus the wait that keeps it out of a slot", () => {
    const queued = runLaunchResponseSchema.parse({
      run: { ...RUN, status: "queued" },
      wait: {
        kind: "concurrency_limit",
        position: 2,
        active_sessions: 4,
        max_concurrent_sessions: 4,
      },
    });

    expect(queued.wait).toMatchObject({ kind: "concurrency_limit", position: 2 });
    expect(runLaunchResponseSchema.parse({ run: RUN, wait: null }).wait).toBeNull();
  });

  it("rejects a wait with no reason and a position that is not a place in line", () => {
    expect(runLaunchResponseSchema.safeParse({ run: RUN }).success).toBe(false);
    expect(
      runLaunchResponseSchema.safeParse({
        run: RUN,
        wait: { kind: "workflow_dependency", blocked_by: [] },
      }).success,
    ).toBe(false);
    expect(
      runLaunchResponseSchema.safeParse({
        run: RUN,
        wait: {
          kind: "concurrency_limit",
          position: 0,
          active_sessions: 4,
          max_concurrent_sessions: 4,
        },
      }).success,
    ).toBe(false);
  });
});

describe("agent capacity", () => {
  it("accepts only a positive whole number of sessions", () => {
    expect(updateAgentCapacityRequestSchema.parse({ max_concurrent_sessions: 6 })).toEqual({
      max_concurrent_sessions: 6,
    });
    for (const value of [0, -1, 1.5, "6", null]) {
      const refused = updateAgentCapacityRequestSchema.safeParse({
        max_concurrent_sessions: value,
      });
      expect(refused.success).toBe(false);
    }
    expect(
      updateAgentCapacityRequestSchema.safeParse({ max_concurrent_sessions: 6, extra: 1 }).success,
    ).toBe(false);
  });

  it("lets a host report more active sessions than its lowered cap", () => {
    expect(
      agentCapacitySchema.parse({
        max_concurrent_sessions: 1,
        active_sessions: 2,
        waiting_sessions: 3,
      }),
    ).toEqual({ max_concurrent_sessions: 1, active_sessions: 2, waiting_sessions: 3 });
  });
});

describe("runDetailSchema", () => {
  it("defaults the live fields so a daemon deployed before them still parses", () => {
    const detail = runDetailSchema.parse({
      run: RUN,
      steps: [],
      sessions: [],
      compete_groups: [],
      worktree_path: null,
      base_branch: null,
    });

    expect(detail.wait).toBeNull();
    expect(detail.resume.mode).toBe("unavailable");
    expect(detail.holds_workspace).toBe(false);
  });

  it("carries the resume mode the daemon resolved, including its fallback reason", () => {
    const base = { run: RUN, steps: [], sessions: [], compete_groups: [] };
    const recovery = runDetailSchema.parse({
      ...base,
      worktree_path: "/tmp/wt",
      base_branch: "main",
      resume: { mode: "recovery", reason: "No provider session was recorded for this step" },
      holds_workspace: true,
    });
    expect(recovery.resume).toEqual({
      mode: "recovery",
      reason: "No provider session was recorded for this step",
    });
    expect(recovery.holds_workspace).toBe(true);
    expect(
      runDetailSchema.safeParse({ ...base, worktree_path: null, base_branch: null, resume: {} })
        .success,
    ).toBe(false);
  });

  it("carries the run's worktree path and base branch, and accepts null for legacy runs", () => {
    const base = { run: RUN, steps: [], sessions: [], compete_groups: [] };
    const withPath = runDetailSchema.parse({
      ...base,
      worktree_path: "/tmp/wt",
      base_branch: "develop",
    });
    expect(withPath.worktree_path).toBe("/tmp/wt");
    expect(withPath.base_branch).toBe("develop");
    const legacy = runDetailSchema.parse({ ...base, worktree_path: null, base_branch: null });
    expect(legacy.worktree_path).toBeNull();
    expect(legacy.base_branch).toBeNull();
    expect(runDetailSchema.safeParse(base).success).toBe(false);
    expect(runDetailSchema.safeParse({ ...base, worktree_path: null }).success).toBe(false);
  });

  it("rejects omitted compete and candidate worktree fields", () => {
    const detail = {
      run: RUN,
      steps: [
        {
          id: "step-1",
          run_id: RUN.id,
          idx: 0,
          name: "Step",
          status: "queued",
        },
      ],
      sessions: [],
      worktree_path: null,
      base_branch: null,
    };

    expect(runDetailSchema.safeParse(detail).success).toBe(false);
    expect(runDetailSchema.safeParse({ ...detail, steps: [], compete_groups: [] }).success).toBe(
      true,
    );
  });

  it("carries durable compete groups and candidate worktree metadata", () => {
    const detail = runDetailSchema.parse({
      run: { ...RUN, status: "awaiting_selection" },
      steps: [
        {
          id: "candidate-a",
          run_id: RUN.id,
          idx: 0,
          name: "Candidate A",
          status: "succeeded",
          compete_group_id: "implementation",
          worktree_id: "wt-a",
          branch: "otomat/run/run-1/compete/candidate-a",
          worktree_status: "archived",
          provider_wait: null,
          next_turn_config: null,
        },
      ],
      sessions: [],
      compete_groups: [
        {
          id: "implementation",
          run_id: RUN.id,
          idx: 0,
          name: "Implementation",
          status: "awaiting_selection",
          winner_step_run_id: null,
          base_head_sha: "abc123",
        },
      ],
      worktree_path: "/tmp/canonical",
      base_branch: "main",
    });

    expect(detail.compete_groups[0]?.status).toBe("awaiting_selection");
    expect(detail.steps[0]?.branch).toContain("candidate-a");
  });
});

describe("selectCompeteWinnerRequestSchema", () => {
  it("accepts one explicit candidate and rejects hidden selection policy", () => {
    expect(selectCompeteWinnerRequestSchema.parse({ step_run_id: "candidate-a" })).toEqual({
      step_run_id: "candidate-a",
    });
    expect(
      selectCompeteWinnerRequestSchema.safeParse({
        step_run_id: "candidate-a",
        policy: "highest-score",
      }).success,
    ).toBe(false);
  });
});

describe("createIssueRequestSchema", () => {
  it("accepts a titled request and trims the title", () => {
    const parsed = createIssueRequestSchema.parse({
      project_id: "p1",
      title: "  Fix parser  ",
      body: "details",
    });
    expect(parsed).toEqual({ project_id: "p1", title: "Fix parser", body: "details" });
  });

  it("accepts an omitted body", () => {
    expect(createIssueRequestSchema.parse({ project_id: "p1", title: "T" }).body).toBeUndefined();
  });

  it("rejects a blank title and a missing project", () => {
    expect(createIssueRequestSchema.safeParse({ project_id: "p1", title: "   " }).success).toBe(
      false,
    );
    expect(createIssueRequestSchema.safeParse({ title: "T" }).success).toBe(false);
    expect(createIssueRequestSchema.safeParse({ project_id: "", title: "T" }).success).toBe(false);
  });
});

describe("createRunContributionRequestSchema", () => {
  it("accepts a body and trims it", () => {
    expect(
      createRunContributionRequestSchema.parse({
        step_run_id: "s1",
        target_agent_session_id: "session-1",
        target_config_hash: "config-1",
        body: "  continue with tests  ",
      }),
    ).toEqual({
      step_run_id: "s1",
      target_agent_session_id: "session-1",
      target_config_hash: "config-1",
      body: "continue with tests",
    });
  });

  it("rejects a blank or missing body", () => {
    expect(
      createRunContributionRequestSchema.safeParse({ step_run_id: "s1", body: "   " }).success,
    ).toBe(false);
    expect(createRunContributionRequestSchema.safeParse({ step_run_id: "s1" }).success).toBe(false);
  });

  it("refuses a message that names no step, so delivery is never left to guess", () => {
    expect(createRunContributionRequestSchema.safeParse({ body: "continue" }).success).toBe(false);
    expect(
      createRunContributionRequestSchema.safeParse({ step_run_id: "", body: "continue" }).success,
    ).toBe(false);
  });
});

describe("runtime availability contract", () => {
  it("parses both availability variants", () => {
    expect(runtimeAvailabilitySchema.parse({ status: "available", version: null }).status).toBe(
      "available",
    );
    expect(
      runtimeAvailabilitySchema.parse({ status: "unavailable", reason: "binary_not_found" }),
    ).toEqual({ status: "unavailable", reason: "binary_not_found" });
    expect(
      runtimeAvailabilitySchema.parse({ status: "unavailable", reason: "sandbox_unavailable" }),
    ).toEqual({ status: "unavailable", reason: "sandbox_unavailable" });
  });

  it("rejects an unavailable state with an unknown reason", () => {
    expect(
      runtimeAvailabilitySchema.safeParse({ status: "unavailable", reason: "eaten_by_bear" })
        .success,
    ).toBe(false);
  });

  it("requires kind and availability on a runtime descriptor", () => {
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
        permissions: false,
        diff_hints: false,
        provider_limit: "deadline",
      },
      availability: { status: "unavailable", reason: "binary_not_found" },
    };
    expect(runtimeDescriptorSchema.parse(descriptor)).toEqual(descriptor);
    const { availability: _availability, ...withoutAvailability } = descriptor;
    expect(runtimeDescriptorSchema.safeParse(withoutAvailability).success).toBe(false);
  });
});

describe("startRunRequestSchema project pinning", () => {
  it("accepts an ad-hoc prompt with a project_id", () => {
    const parsed = startRunRequestSchema.parse({ prompt: "do it", project_id: "p1" });
    expect(parsed.project_id).toBe("p1");
  });

  it("still requires an issue_id or a prompt", () => {
    expect(startRunRequestSchema.safeParse({ project_id: "p1" }).success).toBe(false);
  });
});

describe("repository registration contracts", () => {
  it("trims the registered path and rejects a blank one", () => {
    expect(registerRepositoryRequestSchema.parse({ path: "  /tmp/repo  " })).toEqual({
      path: "/tmp/repo",
    });
    expect(registerRepositoryRequestSchema.safeParse({ path: "   " }).success).toBe(false);
  });

  it("only admits the enumerated registration error codes", () => {
    expect(
      repositoryRegistrationErrorSchema.parse({ error: "head_detached", message: "m" }).error,
    ).toBe("head_detached");
    expect(
      repositoryRegistrationErrorSchema.safeParse({ error: "disk_on_fire", message: "m" }).success,
    ).toBe(false);
  });
});
