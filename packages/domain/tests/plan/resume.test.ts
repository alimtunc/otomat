import { describe, expect, it } from "vitest";

import { resolveStepContributionRoute, selectLatestResumableSession } from "#domain/plan/resume";

describe("selectLatestResumableSession", () => {
  it("selects the latest session on the furthest eligible step", () => {
    const sessions = [
      {
        id: "early",
        step_run_id: "early",
        kind: "step" as const,
        provider_session_id: "provider-early",
      },
      {
        id: "late-old",
        step_run_id: "late",
        kind: "step" as const,
        provider_session_id: "provider-late-old",
      },
      {
        id: "late-new",
        step_run_id: "late",
        kind: "step" as const,
        provider_session_id: "provider-late-new",
      },
    ];

    expect(
      selectLatestResumableSession(
        sessions,
        [
          { id: "early", idx: 0, compete_group_id: null },
          { id: "late", idx: 1, compete_group_id: null },
        ],
        [],
      )?.id,
    ).toBe("late-new");
  });

  it("never resumes a supervision turn, which names the step it judged", () => {
    const sessions = [
      { id: "turn", step_run_id: "s1", kind: "step" as const, provider_session_id: "provider-1" },
      {
        id: "judge",
        step_run_id: "s1",
        kind: "supervision" as const,
        provider_session_id: "provider-2",
      },
    ];

    expect(
      selectLatestResumableSession(sessions, [{ id: "s1", idx: 0, compete_group_id: null }], [])
        ?.id,
    ).toBe("turn");
  });

  it("excludes losing compete candidates", () => {
    const sessions = [
      {
        id: "loser-session",
        step_run_id: "loser",
        kind: "step" as const,
        provider_session_id: "provider-loser",
      },
      {
        id: "winner-session",
        step_run_id: "winner",
        kind: "step" as const,
        provider_session_id: "provider-winner",
      },
    ];

    expect(
      selectLatestResumableSession(
        sessions,
        [
          { id: "loser", idx: 1, compete_group_id: "group" },
          { id: "winner", idx: 0, compete_group_id: "group" },
        ],
        [{ id: "group", winner_step_run_id: "winner" }],
      )?.id,
    ).toBe("winner-session");
  });

  it("refuses to resume any candidate while its group is still undecided", () => {
    const sessions = [
      {
        id: "a-session",
        step_run_id: "a",
        kind: "step" as const,
        provider_session_id: "provider-a",
      },
    ];

    expect(
      selectLatestResumableSession(
        sessions,
        [{ id: "a", idx: 0, compete_group_id: "group" }],
        [{ id: "group", winner_step_run_id: null }],
      ),
    ).toBeUndefined();
  });
});

describe("resolveStepContributionRoute", () => {
  const step = { id: "s1", idx: 0, compete_group_id: null, status: "running" as const };

  it("steers a step that already owns a session, and opens the first turn of one that does not", () => {
    expect(
      resolveStepContributionRoute(
        step,
        [{ step_run_id: "s1", kind: "step" as const, provider_session_id: null }],
        [],
      ),
    ).toBe("steering");
    expect(resolveStepContributionRoute(step, [], [])).toBe("first_turn");
  });

  it("closes a terminal step that never opened a session, whatever ended it", () => {
    for (const status of ["canceled", "failed", "succeeded", "stale"] as const) {
      expect(resolveStepContributionRoute({ ...step, status }, [], [])).toBeNull();
    }
  });

  it("keeps a finished step open while its session survives, because resuming it is the follow-up flow", () => {
    expect(
      resolveStepContributionRoute(
        { ...step, status: "succeeded" },
        [{ step_run_id: "s1", kind: "step" as const, provider_session_id: "provider-1" }],
        [],
      ),
    ).toBe("steering");
  });

  it("keeps every candidate open while its group is undecided, and closes only the ones it decided against", () => {
    const candidate = { ...step, compete_group_id: "group" };
    const sessions = [
      { step_run_id: "s1", kind: "step" as const, provider_session_id: "provider-1" },
    ];

    expect(
      resolveStepContributionRoute(candidate, sessions, [
        { id: "group", winner_step_run_id: null },
      ]),
    ).toBe("steering");
    expect(
      resolveStepContributionRoute(candidate, sessions, [
        { id: "group", winner_step_run_id: "s1" },
      ]),
    ).toBe("steering");
    expect(
      resolveStepContributionRoute(candidate, sessions, [
        { id: "group", winner_step_run_id: "other" },
      ]),
    ).toBeNull();
  });
});
