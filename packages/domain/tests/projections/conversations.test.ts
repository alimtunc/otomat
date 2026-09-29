import { describe, expect, it } from "vitest";

import type { InboxMark } from "#domain/contracts/inbox";
import type { TerminalSession } from "#domain/contracts/terminal";
import {
  countUnreadConversations,
  isConversationFollowed,
  projectConversations,
  projectFollowedCycle,
  projectTerminalConversations,
  type ConversationCycles,
} from "#domain/projections/conversations";
import type { IssueExecutionEvidence } from "#domain/projections/evidence";
import { RUN_STATES, type RunState } from "#domain/state-machines/run";
import { conversationEvidence } from "#test-support/conversation-evidence";
import { AT, issueExecutionEvidence } from "#test-support/issue-execution-evidence";

const T0 = "2026-09-19T10:00:00.000Z";
const T1 = "2026-09-19T10:05:00.000Z";
const T2 = "2026-09-19T10:10:00.000Z";

const NO_CYCLES: ConversationCycles = new Map();
const FOLLOWED: ConversationCycles = new Map([["issue-1", { state: "running", run_id: "run-1" }]]);

const updatedAtOf = (overrides: Parameters<typeof conversationEvidence>[0]) =>
  projectConversations([conversationEvidence(overrides)], [], NO_CYCLES)[0]?.updated_at;

const mark = (overrides: Partial<InboxMark> = {}): InboxMark => ({
  entry_id: "conversation:step-1",
  read: true,
  archived: false,
  evidence_updated_at: T1,
  ...overrides,
});

const session = (overrides: Partial<TerminalSession> = {}): TerminalSession => ({
  id: "00000000-0000-4000-8000-000000000001",
  project_id: "project-1",
  issue_id: null,
  worktree_id: null,
  path: "/tmp/otomat",
  branch: "main",
  started_at: T0,
  tool: null,
  state: "running",
  exit_code: null,
  signal: null,
  ...overrides,
});

describe("projectConversations", () => {
  it("keys the entry by its step and reads the participant from the frozen configuration", () => {
    const [entry] = projectConversations(
      [conversationEvidence({ reported_model: "opus-4" })],
      [],
      FOLLOWED,
    );

    expect(entry).toMatchObject({
      id: "conversation:step-1",
      step_run_id: "step-1",
      participant: {
        runtime: "claude",
        profile_name: "Implementer",
        model: "opus-4",
        effort: "high",
      },
      last: null,
      read: false,
      archived: false,
    });
  });

  it("moves the thread on an agent answer but not on the operator's own message", () => {
    const answered = projectConversations(
      [conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } })],
      [],
      NO_CYCLES,
    );
    const asked = projectConversations(
      [conversationEvidence({ last_user_message: { text: "Please fix.", at: T2 } })],
      [],
      NO_CYCLES,
    );

    expect(answered[0]?.updated_at).toBe(T1);
    expect(answered[0]?.last).toEqual({ kind: "agent", text: "Done.", at: T1 });
    expect(asked[0]?.updated_at).toBe(T0);
    expect(asked[0]?.last).toEqual({ kind: "user", text: "Please fix.", at: T2 });
  });

  it("moves on an actionable step state, a pending question and a failed delivery, never on running", () => {
    expect(updatedAtOf({ step_status: "running", step_updated_at: T2 })).toBe(T0);
    expect(
      updatedAtOf({
        step_status: "succeeded",
        latest_session_status: "terminated",
        step_updated_at: T2,
      }),
    ).toBe(T2);
    expect(updatedAtOf({ step_status: "awaiting_permission", step_updated_at: T2 })).toBe(T2);
    expect(
      updatedAtOf({
        pending_interaction: { kind: "permission", prompt: "Run pnpm check?", requested_at: T1 },
      }),
    ).toBe(T1);
    expect(updatedAtOf({ failed_contribution_at: T2 })).toBe(T2);
  });

  it("surfaces the pending question as the last line even when an answer came later", () => {
    const [entry] = projectConversations(
      [
        conversationEvidence({
          last_agent_message: { text: "Checking.", at: T1 },
          pending_interaction: { kind: "permission", prompt: "Run pnpm check?", requested_at: T2 },
        }),
      ],
      [],
      NO_CYCLES,
    );

    expect(entry?.last).toEqual({ kind: "interaction", text: "Run pnpm check?", at: T2 });
    expect(entry?.pending_interaction).toEqual({ kind: "permission", prompt: "Run pnpm check?" });
  });

  it("honours a mark until the thread moves past it", () => {
    const evidence = conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } });

    const [current] = projectConversations([evidence], [mark({ archived: true })], FOLLOWED);
    const [stale] = projectConversations(
      [{ ...evidence, last_agent_message: { text: "More.", at: T2 } }],
      [mark({ archived: true })],
      FOLLOWED,
    );

    expect(current).toMatchObject({ read: true, archived: true });
    expect(stale).toMatchObject({ read: false, archived: false });
  });

  it("never reads a cancelled step or an abandoned run as news", () => {
    const entries = projectConversations(
      [
        conversationEvidence({ step_run_id: "step-c", step_status: "canceled" }),
        conversationEvidence({ step_run_id: "step-a", run_abandoned_at: T1 }),
      ],
      [],
      FOLLOWED,
    );

    expect(entries.every((entry) => entry.read)).toBe(true);
    expect(countUnreadConversations(entries)).toBe(0);
  });

  it("orders by last activity, newest first, and counts each unread thread once", () => {
    const entries = projectConversations(
      [
        conversationEvidence({ step_run_id: "old", step_created_at: T0 }),
        conversationEvidence({
          step_run_id: "new",
          step_created_at: T0,
          last_agent_message: { text: "One.", at: T2 },
        }),
        conversationEvidence({ step_run_id: "read", step_created_at: T1 }),
      ],
      [mark({ entry_id: "conversation:read", evidence_updated_at: T1 })],
      FOLLOWED,
    );

    expect(entries.map((entry) => entry.step_run_id)).toEqual(["new", "read", "old"]);
    expect(countUnreadConversations(entries)).toBe(2);
  });

  it("keeps a finished thread listed but never as news, whatever its mark says", () => {
    const evidence = conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } });

    const followed = projectConversations([evidence], [], FOLLOWED);
    const finished = projectConversations([evidence], [mark({ read: false })], NO_CYCLES);

    expect(followed[0]?.read).toBe(false);
    expect(countUnreadConversations(followed)).toBe(1);
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ read: true, issue: { cycle: null } });
    expect(countUnreadConversations(finished)).toBe(0);
  });

  it("brings a read thread back once for later activity and never for the same evidence again", () => {
    const seen = conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } });
    const spoke = { ...seen, last_agent_message: { text: "One more thing.", at: T2 } };
    const project = (evidence: typeof seen, marks: InboxMark[]) =>
      projectConversations([evidence], marks, FOLLOWED);

    expect(project(seen, [mark()])[0]?.read).toBe(true);
    expect(countUnreadConversations(project(spoke, [mark()]))).toBe(1);
    expect(project(spoke, [mark({ evidence_updated_at: T2 })])[0]?.read).toBe(true);
  });

  it("stamps each thread with its issue's followed cycle, null once nothing is left to follow", () => {
    const cycles: ConversationCycles = new Map([
      ["issue-1", { state: "reviewing", run_id: "run-1" }],
    ]);
    const [followed, done] = projectConversations(
      [
        conversationEvidence({ step_run_id: "a" }),
        conversationEvidence({ step_run_id: "b", issue_id: "issue-2" }),
      ],
      [],
      cycles,
    );

    expect(followed?.issue.cycle).toBe("reviewing");
    expect(done?.issue.cycle).toBeNull();
  });

  it("reads a succeeded step as running only while its next turn is live", () => {
    const statusOf = (overrides: Parameters<typeof conversationEvidence>[0]) =>
      projectConversations([conversationEvidence(overrides)], [], NO_CYCLES)[0]?.step_status;

    expect(statusOf({ step_status: "running" })).toBe("running");
    expect(statusOf({ step_status: "queued", latest_session_status: null })).toBe("queued");
    expect(statusOf({ step_status: "succeeded", latest_session_status: "terminated" })).toBe(
      "succeeded",
    );
    expect(statusOf({ step_status: "succeeded", latest_session_status: "active" })).toBe("running");
    expect(statusOf({ step_status: "succeeded", latest_session_status: "created" })).toBe(
      "succeeded",
    );
    expect(statusOf({ step_status: "succeeded", latest_session_status: "awaiting_input" })).toBe(
      "succeeded",
    );
    expect(statusOf({ step_status: "failed", latest_session_status: "failed" })).toBe("failed");
    expect(statusOf({ step_status: "canceled", latest_session_status: "terminated" })).toBe(
      "canceled",
    );
  });

  it("reads a live follow-up turn blocked on a question as waiting, never as running", () => {
    const asking = {
      kind: "choice",
      prompt: "Which parser?",
      requested_at: "2026-09-19T10:05:00.000Z",
    } as const;
    const [entry] = projectConversations(
      [
        conversationEvidence({
          step_status: "succeeded",
          latest_session_status: "active",
          run_status: "awaiting_permission",
          pending_interaction: asking,
        }),
      ],
      [],
      NO_CYCLES,
    );

    expect(entry?.step_status).toBe("awaiting_permission");
    expect(entry?.pending_interaction).toEqual({ kind: "choice", prompt: "Which parser?" });
  });
});

describe("projectTerminalConversations", () => {
  const issue = { id: "issue-1", identifier: "OTO-1", title: "Ship it" };
  const project = (terminal: TerminalSession, linked: typeof issue | null, cycles = NO_CYCLES) =>
    projectTerminalConversations(
      [{ session: terminal, updated_at: T1, project_name: "Otomat", issue: linked }],
      [],
      cycles,
    )[0];

  it("reads a terminal as news only while it runs or its issue's cycle is open", () => {
    const running = project(session(), null);
    const ended = project(session({ state: "exited", exit_code: 0 }), null);
    const endedInCycle = project(session({ state: "exited", exit_code: 0 }), issue, FOLLOWED);

    expect(running).toMatchObject({ read: false });
    expect(ended).toMatchObject({ read: true });
    expect(endedInCycle).toMatchObject({ read: false, issue: { cycle: "running" } });
    expect(
      [running, ended, endedInCycle].map((entry) => entry && isConversationFollowed(entry)),
    ).toEqual([true, false, true]);
  });
});

const execution = (over: Partial<IssueExecutionEvidence> = {}): IssueExecutionEvidence =>
  issueExecutionEvidence({ run_id: "run-1", run_status: "running", ...over });

const FOLLOWED_WITH_WORKTREE = {
  queued: "running",
  preparing: "running",
  running: "running",
  awaiting_permission: "awaiting_input",
  awaiting_human: "failed",
  awaiting_selection: "awaiting_input",
  waiting_for_provider: "waiting_for_provider",
  review_ready: "reviewing",
  completed: null,
  failed: "failed",
  canceled: "failed",
} satisfies Record<RunState, string | null>;

const FOLLOWED_WITHOUT_WORKTREE = {
  queued: "running",
  preparing: "running",
  running: "running",
  awaiting_permission: "awaiting_input",
  awaiting_human: "awaiting_input",
  awaiting_selection: "awaiting_input",
  waiting_for_provider: null,
  review_ready: null,
  completed: null,
  failed: null,
  canceled: null,
} satisfies Record<RunState, string | null>;

describe("projectFollowedCycle", () => {
  it("follows every run state but a merged completion while the run holds its worktree", () => {
    for (const run_status of RUN_STATES) {
      expect(projectFollowedCycle([execution({ run_status })])?.state ?? null, run_status).toBe(
        FOLLOWED_WITH_WORKTREE[run_status],
      );
    }
  });

  it("follows only a live run once the worktree is gone or not created yet", () => {
    for (const run_status of RUN_STATES) {
      const expected = FOLLOWED_WITHOUT_WORKTREE[run_status];
      for (const worktree_status of [null, "removed"] as const) {
        expect(
          projectFollowedCycle([execution({ run_status, worktree_status })])?.state ?? null,
          `${run_status} / ${worktree_status}`,
        ).toBe(expected);
      }
    }
  });

  it("stops following a closed issue once its run is at rest, and an abandoned cycle at once", () => {
    expect(projectFollowedCycle([execution({ issue_status: "done" })])?.state).toBe("running");
    expect(
      projectFollowedCycle([
        execution({ issue_status: "done", run_status: "awaiting_human", worktree_status: null }),
      ]),
    ).toBeNull();
    expect(
      projectFollowedCycle([execution({ issue_status: "done", run_status: "review_ready" })]),
    ).toBeNull();
    expect(
      projectFollowedCycle([execution({ issue_status: "canceled", run_status: "failed" })]),
    ).toBeNull();
    for (const worktree_status of ["active", null] as const) {
      expect(
        projectFollowedCycle([execution({ run_abandoned_at: AT("2"), worktree_status })]),
      ).toBeNull();
    }
  });

  it("keeps a merged cycle's open pull request out and follows a live one", () => {
    const merged = execution({
      run_status: "completed",
      pr_status: "merged",
      pr_publication: "created",
    });
    const live = execution({
      run_status: "review_ready",
      pr_status: "open",
      pr_publication: "created",
    });

    expect(projectFollowedCycle([merged])).toBeNull();
    expect(projectFollowedCycle([live])).toEqual({ state: "pr_open", run_id: "run-1" });
    expect(projectFollowedCycle([{ ...live, pr_status: "closed" }])).toBeNull();
  });

  it("answers for the issue's latest run, so a fresh launch outranks a finished one", () => {
    expect(
      projectFollowedCycle([
        execution({ run_id: "old", run_status: "completed" }),
        execution({
          run_id: "new",
          run_status: "queued",
          run_created_at: AT("2"),
          worktree_status: null,
        }),
      ]),
    ).toEqual({ state: "running", run_id: "new" });
  });
});
