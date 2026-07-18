import { describe, expect, it } from "vitest";

import {
  createIssueRequestSchema,
  followUpRunRequestSchema,
  runDetailSchema,
  runtimeAvailabilitySchema,
  runtimeDescriptorSchema,
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
