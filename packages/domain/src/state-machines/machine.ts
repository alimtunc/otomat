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
