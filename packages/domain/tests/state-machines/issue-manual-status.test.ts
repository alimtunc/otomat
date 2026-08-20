import { expect, it } from "vitest";

import { ISSUE_EXECUTION_STATES } from "#domain/contracts/entities/issue-execution";
import {
  ISSUE_STATES,
  isIssueClosed,
  issueMachine,
  MANUAL_ISSUE_STATES,
  manualIssueTargets,
} from "#domain/state-machines/issue";

it("offers ready and done from every state an issue can be worked from", () => {
  for (const status of ISSUE_STATES) {
    if (status === "canceled") continue;
    const targets = manualIssueTargets(status);
    expect(targets).not.toContain(status);
    for (const target of MANUAL_ISSUE_STATES) {
      if (target === status) continue;
      expect(targets).toContain(target);
    }
  }
});

it("reopens a done issue as ready and refuses to reopen a canceled one", () => {
  expect(manualIssueTargets("done")).toEqual(["ready"]);
  expect(issueMachine.transition("done", "ready")).toBe("ready");

  expect(manualIssueTargets("canceled")).toEqual([]);
  expect(issueMachine.canTransition("canceled", "ready")).toBe(false);
});

it("never offers an execution state as a manual target", () => {
  for (const state of ISSUE_EXECUTION_STATES) {
    expect(MANUAL_ISSUE_STATES).not.toContain(state);
  }
});

it("reads done and canceled as closed, whatever the machine still allows", () => {
  expect(ISSUE_STATES.filter(isIssueClosed)).toEqual(["done", "canceled"]);
  expect(issueMachine.isTerminal("done")).toBe(false);
});
