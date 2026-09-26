import type {
  ComparedWorkspaceFreshness,
  RemoteRefComparison,
  WorkspaceFreshness,
} from "@otomat/domain";
import {
  conflictAdvice,
  freshnessActions,
  freshnessCleared,
  freshnessDetails,
  freshnessGate,
} from "@web/lib/run/workspace-freshness";
import { expect, it } from "vitest";

function comparison(overrides: Partial<RemoteRefComparison>): RemoteRefComparison {
  return { ref: "origin/main", sha: "main-1", ahead: 0, behind: 0, strategies: [], ...overrides };
}

const CURRENT: ComparedWorkspaceFreshness = {
  state: "up_to_date",
  branch: comparison({ ref: "origin/feat/csv", sha: "head-1" }),
  base: comparison({ ahead: 2 }),
  dirty: false,
};

const DIVERGED: ComparedWorkspaceFreshness = {
  ...CURRENT,
  state: "diverged",
  branch: comparison({
    ref: "origin/feat/csv",
    sha: "head-2",
    ahead: 1,
    behind: 2,
    strategies: ["rebase", "merge"],
  }),
  base: comparison({ sha: "main-2", ahead: 2, behind: 4 }),
};

const reading = (data: WorkspaceFreshness | undefined, isError = false, isFetching = false) => ({
  data,
  isError,
  isFetching,
});

it("clears an up-to-date workspace and holds everything else for an acknowledgment", () => {
  expect(freshnessGate(reading(CURRENT))).toEqual({ kind: "clear" });
  expect(freshnessGate(reading(undefined))).toEqual({ kind: "checking" });
  expect(freshnessGate(reading(CURRENT, false, true))).toEqual({ kind: "checking" });

  const stale = freshnessGate(reading(DIVERGED));
  expect(stale).toMatchObject({ kind: "acknowledge", reason: "stale" });
  expect(freshnessCleared(stale, "")).toBe(false);
  expect(stale.kind === "acknowledge" && freshnessCleared(stale, stale.key)).toBe(true);
});

it("never clears a check that failed, even over an older answer that was current", () => {
  expect(freshnessGate(reading(CURRENT, true))).toMatchObject({
    kind: "acknowledge",
    reason: "unchecked",
  });
  expect(
    freshnessGate(
      reading({
        state: "unverifiable",
        failure: { message: "unreachable", remote: { failure: "unreachable", detail: null } },
      }),
    ),
  ).toMatchObject({ kind: "acknowledge", reason: "unchecked" });
});

it("asks again once the remote moves, but keeps an acknowledgment of the same state", () => {
  const acknowledged = freshnessGate(reading(DIVERGED));
  const same = freshnessGate(reading({ ...DIVERGED }));
  const moved = freshnessGate(
    reading({ ...DIVERGED, branch: comparison({ ...DIVERGED.branch, sha: "head-3" }) }),
  );
  if (acknowledged.kind !== "acknowledge") throw new Error("expected an acknowledgment");

  expect(freshnessCleared(same, acknowledged.key)).toBe(true);
  expect(freshnessCleared(moved, acknowledged.key)).toBe(false);
});

it("counts what each side lacks and asks for the branch before the base", () => {
  expect(freshnessDetails(DIVERGED)).toEqual([
    "origin/feat/csv has 2 commits this workspace does not, and the workspace has 1 commit it does not.",
    "origin/main gained 4 commits since this workspace last took it. Take origin/feat/csv first.",
  ]);
  expect(freshnessDetails(CURRENT)).toEqual([
    "The workspace carries everything origin/feat/csv and origin/main hold.",
  ]);
});

it("offers exactly the strategies the daemon judged safe, naming a fast-forward as such", () => {
  expect(freshnessActions(DIVERGED).map((action) => action.label)).toEqual([
    "Rebase onto origin/feat/csv",
    "Merge origin/feat/csv",
  ]);
  expect(
    freshnessActions({
      ...CURRENT,
      state: "behind",
      branch: comparison({ ref: "origin/feat/csv", behind: 1, strategies: ["merge"] }),
    }),
  ).toEqual([
    { request: { source: "branch", strategy: "merge" }, label: "Fast-forward to origin/feat/csv" },
  ]);
});

it("explains how to redo an aborted update by hand from a fresh fetch", () => {
  expect(conflictAdvice("rebase", "upstream/main")).toContain(
    "git fetch upstream, git rebase upstream/main",
  );
});
