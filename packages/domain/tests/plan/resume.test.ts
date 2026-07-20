import { describe, expect, it } from "vitest";

import { selectLatestResumableSession } from "#domain/plan/resume";

describe("selectLatestResumableSession", () => {
  it("selects the latest session on the furthest eligible step", () => {
    const sessions = [
      { id: "early", step_run_id: "early", provider_session_id: "provider-early" },
      { id: "late-old", step_run_id: "late", provider_session_id: "provider-late-old" },
      { id: "late-new", step_run_id: "late", provider_session_id: "provider-late-new" },
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

  it("excludes losing compete candidates", () => {
    const sessions = [
      { id: "loser-session", step_run_id: "loser", provider_session_id: "provider-loser" },
      { id: "winner-session", step_run_id: "winner", provider_session_id: "provider-winner" },
    ];

    expect(
      selectLatestResumableSession(
        sessions,
        [
          { id: "loser", idx: 1, compete_group_id: "group" },
          { id: "winner", idx: 0, compete_group_id: "group" },
        ],
        [{ winner_step_run_id: "winner" }],
      )?.id,
    ).toBe("winner-session");
  });
});
