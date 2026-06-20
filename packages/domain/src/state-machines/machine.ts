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
