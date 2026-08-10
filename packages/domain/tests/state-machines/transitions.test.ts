import { describe, expect, it } from "vitest";

import { agentSessionMachine } from "#domain/state-machines/agent-session";
import { competeGroupMachine } from "#domain/state-machines/compete-group";
import { issueMachine } from "#domain/state-machines/issue";
import { linearWriteMachine } from "#domain/state-machines/linear-write";
import { IllegalTransitionError } from "#domain/state-machines/machine";
import { pullRequestMachine } from "#domain/state-machines/pull-request";
import { pullRequestPublicationMachine } from "#domain/state-machines/pull-request-publication";
import { reviewMachine } from "#domain/state-machines/review";
import { reviewCommentMachine } from "#domain/state-machines/review-comment";
import {
  RUN_FOLLOW_UP_STATES,
  RUN_TERMINAL_STATES,
  RUN_WORKING_STATES,
  canFollowUpRun,
  isRunBusy,
  isRunTerminal,
  isRunWorking,
  runMachine,
} from "#domain/state-machines/run";
import {
  isRunContributionRetriable,
  runContributionMachine,
} from "#domain/state-machines/run-contribution";
import { stepRunMachine } from "#domain/state-machines/step-run";

const machines = [
  issueMachine,
  runMachine,
  stepRunMachine,
  agentSessionMachine,
  reviewMachine,
  reviewCommentMachine,
  pullRequestMachine,
  pullRequestPublicationMachine,
  linearWriteMachine,
  competeGroupMachine,
  runContributionMachine,
];

describe.each(machines.map((machine) => [machine.name, machine] as const))(
  "%s machine",
  (_name, machine) => {
    it("accepts every declared legal transition", () => {
      for (const from of machine.states) {
        for (const to of machine.next(from)) {
          expect(machine.canTransition(from, to)).toBe(true);
          expect(machine.transition(from, to)).toBe(to);
        }
      }
    });

    it("rejects every undeclared transition with IllegalTransitionError", () => {
      for (const from of machine.states) {
        for (const to of machine.states) {
          if (machine.next(from).includes(to)) continue;
          expect(machine.canTransition(from, to)).toBe(false);
          expect(() => machine.transition(from, to)).toThrow(IllegalTransitionError);
        }
      }
    });

    it("reports terminal states consistently with their outgoing edges", () => {
      for (const state of machine.states) {
        expect(machine.isTerminal(state)).toBe(machine.next(state).length === 0);
      }
    });
  },
);

describe("representative illegal transitions are rejected", () => {
  it("issue cannot jump backlog -> done", () => {
    expect(() => issueMachine.transition("backlog", "done")).toThrow(IllegalTransitionError);
  });

  it("run cannot resurrect completed -> running", () => {
    expect(() => runMachine.transition("completed", "running")).toThrow(IllegalTransitionError);
  });

  it("run resumed before its init finished re-enters preparing", () => {
    expect(runMachine.transition("awaiting_human", "preparing")).toBe("preparing");
  });

  it("run and compete group wait for an explicit winner", () => {
    expect(runMachine.transition("running", "awaiting_selection")).toBe("awaiting_selection");
    expect(runMachine.transition("awaiting_selection", "running")).toBe("running");
    expect(competeGroupMachine.transition("running", "awaiting_selection")).toBe(
      "awaiting_selection",
    );
    expect(competeGroupMachine.transition("awaiting_selection", "promoting")).toBe("promoting");
    expect(competeGroupMachine.transition("promoting", "selected")).toBe("selected");
  });

  it("run_contribution cannot be marked sent from a settled state", () => {
    expect(() => runContributionMachine.transition("completed", "sent")).toThrow(
      IllegalTransitionError,
    );
    expect(() => runContributionMachine.transition("failed", "sent")).toThrow(
      IllegalTransitionError,
    );
    expect(runContributionMachine.transition("failed", "queued")).toBe("queued");
  });

  it("run_contribution retry is refused once anything reached the provider", () => {
    expect(isRunContributionRetriable({ status: "failed", delivered_at: null })).toBe(true);
    expect(
      isRunContributionRetriable({ status: "failed", delivered_at: "2026-07-25T10:00:00.000Z" }),
    ).toBe(false);
    expect(isRunContributionRetriable({ status: "sent", delivered_at: null })).toBe(false);
  });

  it("step_run cannot skip queued -> succeeded", () => {
    expect(() => stepRunMachine.transition("queued", "succeeded")).toThrow(IllegalTransitionError);
  });

  it("agent_session cannot revive terminated -> active", () => {
    expect(() => agentSessionMachine.transition("terminated", "active")).toThrow(
      IllegalTransitionError,
    );
  });

  it("review cannot resolve straight from open", () => {
    expect(() => reviewMachine.transition("open", "resolved")).toThrow(IllegalTransitionError);
  });

  it("pull_request cannot reopen merged -> open", () => {
    expect(() => pullRequestMachine.transition("merged", "open")).toThrow(IllegalTransitionError);
  });

  it("pull_request_publication cannot create before pushing", () => {
    expect(() => pullRequestPublicationMachine.transition("not_configured", "creating")).toThrow(
      IllegalTransitionError,
    );
  });

  it("pull_request_publication can update a created PR through pushing", () => {
    expect(pullRequestPublicationMachine.transition("created", "pushing")).toBe("pushing");
  });

  it.each(["not_configured", "failed"] as const)(
    "pull_request_publication can reconcile a confirmed PR from %s",
    (status) => {
      expect(pullRequestPublicationMachine.transition(status, "created")).toBe("created");
    },
  );

  it.each(["pushing", "creating"] as const)(
    "pull_request_publication cannot become not configured from %s",
    (status) => {
      expect(() => pullRequestPublicationMachine.transition(status, "not_configured")).toThrow(
        IllegalTransitionError,
      );
    },
  );

  it("linear_write reconciles an interrupted send to a retryable failure", () => {
    expect(linearWriteMachine.transition("sending", "failed")).toBe("failed");
    expect(linearWriteMachine.transition("failed", "sending")).toBe("sending");
  });

  it("linear_write cannot resurrect a confirmed write", () => {
    expect(linearWriteMachine.isTerminal("sent")).toBe(true);
    expect(() => linearWriteMachine.transition("sent", "sending")).toThrow(IllegalTransitionError);
  });

  it("linear_write cannot skip straight from pending to sent", () => {
    expect(() => linearWriteMachine.transition("pending", "sent")).toThrow(IllegalTransitionError);
  });
});

describe("RUN_TERMINAL_STATES", () => {
  it("matches the run machine's terminal states", () => {
    const derived = runMachine.states.filter((state) => runMachine.isTerminal(state));
    expect([...RUN_TERMINAL_STATES].toSorted()).toEqual(derived.toSorted());
  });
});

describe("RUN_FOLLOW_UP_STATES", () => {
  it.each(RUN_FOLLOW_UP_STATES)("%s can legally resume to running", (status) => {
    expect(canFollowUpRun(status)).toBe(true);
    expect(() => runMachine.transition(status, "running")).not.toThrow();
  });

  it("excludes terminal and active states", () => {
    expect(canFollowUpRun("running")).toBe(false);
    for (const status of RUN_TERMINAL_STATES) expect(canFollowUpRun(status)).toBe(false);
  });
});

describe("RUN_WORKING_STATES", () => {
  it.each(RUN_WORKING_STATES)("%s is working and never resting or terminal", (status) => {
    expect(isRunWorking(status)).toBe(true);
    expect(canFollowUpRun(status)).toBe(false);
    expect(isRunTerminal(status)).toBe(false);
  });

  it("excludes every resting and terminal state", () => {
    for (const status of RUN_FOLLOW_UP_STATES) expect(isRunWorking(status)).toBe(false);
    for (const status of RUN_TERMINAL_STATES) expect(isRunWorking(status)).toBe(false);
  });
});

describe("isRunBusy", () => {
  it.each([...RUN_WORKING_STATES, "awaiting_permission"])("%s occupies the worktree", (status) => {
    expect(isRunBusy(status)).toBe(true);
  });

  it("treats selection-blocked, resting and terminal states as not busy", () => {
    expect(isRunBusy("awaiting_selection")).toBe(false);
    for (const status of RUN_FOLLOW_UP_STATES) expect(isRunBusy(status)).toBe(false);
    for (const status of RUN_TERMINAL_STATES) expect(isRunBusy(status)).toBe(false);
  });
});
