import { RUN_STATES, type RunState } from "@otomat/domain";
import {
  pullRequestDetailFixture,
  pullRequestFixture,
  runDetailFixture,
} from "@web/gallery/gallery.fixtures";
import {
  ctaTargetsCurrentTab,
  resolveNextAction,
  runNextAction,
  type NextAction,
  type NextActionPullRequest,
} from "@web/lib/run/next-action";
import { describe, expect, it } from "vitest";

function pr(overrides: Partial<NextActionPullRequest> = {}): NextActionPullRequest {
  return {
    status: "open",
    number: 7,
    url: "https://github.com/o/r/pull/7",
    publishing: false,
    ...overrides,
  };
}

const EXPECTED = {
  queued: { kind: "follow", cta: "Follow live" },
  preparing: { kind: "follow", cta: "Follow live" },
  running: { kind: "follow", cta: "Follow live" },
  awaiting_permission: { kind: "answer", cta: "Answer the request" },
  awaiting_human: { kind: "answer", cta: "Answer in the conversation" },
  awaiting_selection: { kind: "choose", cta: "Choose the winner" },
  waiting_for_provider: { kind: "wait", cta: null },
  review_ready: { kind: "review", cta: "Review the diff" },
  completed: { kind: "done", cta: null },
  failed: { kind: "open_failed_step", cta: "Open the failing step" },
  canceled: { kind: "stopped", cta: null },
} satisfies Record<RunState, { kind: NextAction["kind"]; cta: string | null }>;

describe("resolveNextAction", () => {
  it.each(RUN_STATES)("resolves %s to exactly one action", (status) => {
    const action = resolveNextAction({ status });
    expect(action.kind).toBe(EXPECTED[status].kind);
    expect(action.cta?.label ?? null).toBe(EXPECTED[status].cta);
    expect(action.description).not.toBe("");
  });

  it("asks for publication when the run completed without a pull request", () => {
    const action = resolveNextAction({ status: "completed", pullRequest: null });
    expect(action.kind).toBe("publish");
    expect(action.cta).toEqual({
      label: "Publish the pull request",
      shortLabel: "Publish",
      target: { type: "pr" },
    });
  });

  it("claims nothing about publication while it is unknown", () => {
    const action = resolveNextAction({ status: "completed" });
    expect(action.kind).toBe("done");
    expect(action.cta).toBeNull();
  });

  it("points at the running publication", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ publishing: true }),
    });
    expect(action.kind).toBe("publishing");
    expect(action.cta?.target).toEqual({ type: "pr" });
  });

  it("links the open pull request externally", () => {
    const action = resolveNextAction({ status: "completed", pullRequest: pr() });
    expect(action.kind).toBe("open_pr");
    expect(action.cta).toEqual({
      label: "Open PR #7",
      target: { type: "external", url: "https://github.com/o/r/pull/7" },
    });
  });

  it("still asks for publication while the row has no provider number", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ status: "draft", number: null, url: null }),
    });
    expect(action.kind).toBe("publish");
    expect(action.cta).toEqual({
      label: "Publish the pull request",
      shortLabel: "Publish",
      target: { type: "pr" },
    });
  });

  it("asks a published draft to be marked ready", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ status: "draft" }),
    });
    expect(action.kind).toBe("open_pr");
    expect(action.description).toContain("draft");
    expect(action.cta?.label).toBe("Open PR #7");
  });

  it("stays done on a merged pull request whose number was never confirmed", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ status: "merged", number: null, url: null }),
    });
    expect(action.kind).toBe("done");
    expect(action.cta).toBeNull();
  });

  it("offers no action on a merged pull request", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ status: "merged" }),
    });
    expect(action.kind).toBe("done");
    expect(action.cta).toBeNull();
    expect(action.description).toContain("merged");
  });

  it("offers no action on a closed pull request", () => {
    const action = resolveNextAction({
      status: "completed",
      pullRequest: pr({ status: "closed" }),
    });
    expect(action.kind).toBe("done");
    expect(action.cta).toBeNull();
    expect(action.description).toContain("closed");
  });

  it("deep-links the failing step when it is known", () => {
    const action = resolveNextAction({ status: "failed", failedStepId: "step-9" });
    expect(action.cta?.target).toEqual({ type: "conversation", stepId: "step-9" });
  });
});

describe("ctaTargetsCurrentTab", () => {
  it("suppresses a CTA that links to the tab already open", () => {
    const publish = resolveNextAction({ status: "completed", pullRequest: null }).cta;
    expect(publish && ctaTargetsCurrentTab(publish, "/runs/r1/pr", "r1")).toBe(true);
    expect(publish && ctaTargetsCurrentTab(publish, "/runs/r1", "r1")).toBe(false);
    const review = resolveNextAction({ status: "review_ready" }).cta;
    expect(review && ctaTargetsCurrentTab(review, "/runs/r1/diff", "r1")).toBe(true);
    const follow = resolveNextAction({ status: "running" }).cta;
    expect(follow && ctaTargetsCurrentTab(follow, "/runs/r1", "r1")).toBe(true);
  });

  it("keeps a step deep-link and external links everywhere", () => {
    const failing = resolveNextAction({ status: "failed", failedStepId: "s9" }).cta;
    expect(failing && ctaTargetsCurrentTab(failing, "/runs/r1", "r1")).toBe(false);
    const open = resolveNextAction({ status: "completed", pullRequest: pr() }).cta;
    expect(open && ctaTargetsCurrentTab(open, "/runs/r1/pr", "r1")).toBe(false);
  });
});

describe("runNextAction", () => {
  it("deep-links the latest failing step from the run detail", () => {
    const action = runNextAction(
      runDetailFixture("failed", [
        { id: "s1", status: "failed" },
        { id: "s2", status: "failed" },
      ]),
      undefined,
    );
    expect(action.cta?.target).toEqual({ type: "conversation", stepId: "s2" });
  });

  it("treats a loaded empty publication as publishable", () => {
    const action = runNextAction(runDetailFixture("completed"), pullRequestDetailFixture(null));
    expect(action.kind).toBe("publish");
  });

  it("reports a running publication from the loaded operation", () => {
    const action = runNextAction(runDetailFixture("completed"), {
      ...pullRequestDetailFixture(pullRequestFixture({})),
      operation: {
        id: "op-1",
        kind: "pull_request_publication",
        state: "running",
        phases: [],
        error: null,
        retryable: false,
        updated_at: "2026-08-30T10:00:00.000Z",
      },
    });
    expect(action.kind).toBe("publishing");
  });

  it("reports the merged pull request from the loaded publication", () => {
    const action = runNextAction(
      runDetailFixture("completed"),
      pullRequestDetailFixture(pullRequestFixture({ status: "merged" })),
    );
    expect(action.kind).toBe("done");
    expect(action.cta).toBeNull();
  });
});
