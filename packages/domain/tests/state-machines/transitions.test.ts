import { describe, expect, it } from "vitest";

import { agentSessionMachine } from "#domain/state-machines/agent-session";
import { issueMachine } from "#domain/state-machines/issue";
import { IllegalTransitionError } from "#domain/state-machines/machine";
import { pullRequestMachine } from "#domain/state-machines/pull-request";
import { reviewMachine } from "#domain/state-machines/review";
import { reviewCommentMachine } from "#domain/state-machines/review-comment";
import { RUN_TERMINAL_STATES, runMachine } from "#domain/state-machines/run";
import { stepRunMachine } from "#domain/state-machines/step-run";

const machines = [
  issueMachine,
  runMachine,
  stepRunMachine,
  agentSessionMachine,
  reviewMachine,
  reviewCommentMachine,
  pullRequestMachine,
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
});

describe("RUN_TERMINAL_STATES", () => {
  it("matches the run machine's terminal states", () => {
    const derived = runMachine.states.filter((state) => runMachine.isTerminal(state));
    expect([...RUN_TERMINAL_STATES].toSorted()).toEqual(derived.toSorted());
  });
});
