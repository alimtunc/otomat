/** Thrown by `StateMachine.transition` when the requested `from -> to` edge is not in the machine's transition table. */
export class IllegalTransitionError extends Error {
  readonly machine: string;
  readonly from: string;
  readonly to: string;

  constructor(machine: string, from: string, to: string) {
    super(`Illegal ${machine} transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
    this.machine = machine;
    this.from = from;
    this.to = to;
  }
}

/**
 * Declarative machine spec. `transitions` is an adjacency map from each state to
 * its legal successors, and its keys are taken as the machine's full state set;
 * terminal states map to `[]`.
 */
export interface MachineDefinition<S extends string> {
  readonly name: string;
  readonly initial: S;
  readonly transitions: Readonly<Record<S, readonly S[]>>;
}

export interface StateMachine<S extends string> {
  readonly name: string;
  readonly initial: S;
  readonly states: readonly S[];
  next(from: S): readonly S[];
  canTransition(from: S, to: S): boolean;
  isTerminal(state: S): boolean;
  /** Returns `to` when the edge is legal; throws IllegalTransitionError otherwise. */
  transition(from: S, to: S): S;
}

/**
 * Builds a StateMachine from a definition. `states` is the set of keys in
 * `transitions`; `next` returns a state's declared successors (`[]` for terminal
 * or undeclared states), so `isTerminal` is true exactly when a state has no
 * outgoing edges. `transition` returns `to` on a legal edge and throws
 * IllegalTransitionError otherwise.
 */
export function defineMachine<S extends string>(definition: MachineDefinition<S>): StateMachine<S> {
  const states = Object.keys(definition.transitions) as S[];
  const next = (from: S): readonly S[] => definition.transitions[from] ?? [];
  const canTransition = (from: S, to: S): boolean => next(from).includes(to);

  return {
    name: definition.name,
    initial: definition.initial,
    states,
    next,
    canTransition,
    isTerminal: (state: S): boolean => next(state).length === 0,
    transition: (from: S, to: S): S => {
      if (!canTransition(from, to)) {
        throw new IllegalTransitionError(definition.name, from, to);
      }
      return to;
    },
  };
}

/** Shortest legal sequence of states from `from` to `to` (excluding `from`, including `to`), or null if unreachable. */
export function shortestPath<S extends string>(
  machine: StateMachine<S>,
  from: S,
  to: S,
): S[] | null {
  if (from === to) return [];
  const queue: S[][] = [[from]];
  const seen = new Set<S>([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) break;
    const last = path.at(-1);
    if (last === undefined) continue;

    for (const next of machine.next(last)) {
      if (seen.has(next)) continue;
      const extended = [...path, next];
      if (next === to) return extended.slice(1);
      seen.add(next);
      queue.push(extended);
    }
  }
  return null;
}

/** Walks `from -> to` along the shortest legal path, invoking `apply` for each state after `from`; throws IllegalTransitionError when `to` is unreachable. */
export function drivePath<S extends string>(
  machine: StateMachine<S>,
  from: S,
  to: S,
  apply: (state: S) => void,
): void {
  const path = shortestPath(machine, from, to);
  if (path === null) throw new IllegalTransitionError(machine.name, from, to);
  for (const state of path) apply(state);
}
