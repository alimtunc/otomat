import { describe, expect, it } from "vitest";

import { resolveStepContributionRoute } from "#domain/plan/resume";

describe("resolveStepContributionRoute", () => {
  const step = { id: "s1", compete_group_id: null, status: "running" as const };

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
