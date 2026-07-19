import { describe, expect, it } from "vitest";

import {
  createIssueRequestSchema,
  followUpRunRequestSchema,
  registerRepositoryRequestSchema,
  repositoryRegistrationErrorSchema,
  runDetailSchema,
  runtimeAvailabilitySchema,
  runtimeDescriptorSchema,
  selectCompeteWinnerRequestSchema,
  startRunRequestSchema,
} from "#domain/contracts/api";

const RUN = {
  id: "run-1",
  issue_id: "i1",
  status: "running",
  branch: "otomat/run/run-1",
  plan_json: { version: 1, steps: [] },
};

describe("runDetailSchema", () => {
  it("carries the run's worktree path and accepts null when it has none", () => {
    const base = { run: RUN, steps: [], sessions: [] };
    const withPath = runDetailSchema.parse({ ...base, worktree_path: "/tmp/wt" });
    expect(withPath.worktree_path).toBe("/tmp/wt");
    expect(runDetailSchema.parse({ ...base, worktree_path: null }).worktree_path).toBeNull();
    expect(runDetailSchema.safeParse(base).success).toBe(false);
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

describe("followUpRunRequestSchema", () => {
  it("accepts a prompt and trims it", () => {
    expect(followUpRunRequestSchema.parse({ prompt: "  continue with tests  " })).toEqual({
      prompt: "continue with tests",
    });
  });

  it("rejects a blank or missing prompt", () => {
    expect(followUpRunRequestSchema.safeParse({ prompt: "   " }).success).toBe(false);
    expect(followUpRunRequestSchema.safeParse({}).success).toBe(false);
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
        send_message: true,
        abort: true,
        resume: true,
        permissions: false,
        diff_hints: false,
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
