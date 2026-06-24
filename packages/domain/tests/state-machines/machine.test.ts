import { describe, expect, it } from "vitest";

import { defineMachine, IllegalTransitionError } from "#domain/state-machines/machine";

const toy = defineMachine({
  name: "toy",
  initial: "a",
  transitions: {
    a: ["b"],
    b: ["a", "c"],
    c: [],
  },
});

describe("defineMachine", () => {
  it("exposes declared states", () => {
    expect(toy.states).toEqual(["a", "b", "c"]);
    expect(toy.initial).toBe("a");
  });

  it("returns the target state for a legal transition", () => {
    expect(toy.transition("a", "b")).toBe("b");
    expect(toy.canTransition("a", "b")).toBe(true);
  });

  it("throws IllegalTransitionError for an undeclared edge", () => {
    expect(() => toy.transition("a", "c")).toThrow(IllegalTransitionError);
    expect(toy.canTransition("a", "c")).toBe(false);
  });

  it("carries machine/from/to on the error", () => {
    try {
      toy.transition("a", "c");
      expect.unreachable("transition should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalTransitionError);
      const illegal = error as IllegalTransitionError;
      expect(illegal.machine).toBe("toy");
      expect(illegal.from).toBe("a");
      expect(illegal.to).toBe("c");
    }
  });

  it("treats a state with no outgoing edges as terminal", () => {
    expect(toy.isTerminal("c")).toBe(true);
    expect(toy.isTerminal("a")).toBe(false);
  });
});
