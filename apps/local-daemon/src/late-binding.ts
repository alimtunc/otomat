/** A service the composition root wires after its consumer is built; reaching it before then is a fault, not a refusal. */
export interface LateBinding<S> {
  bind(service: S): void;
  on<T>(call: (service: S) => Promise<T>): Promise<T>;
}

export function lateBinding<S>(describe: string): LateBinding<S> {
  let target: S | null = null;
  return {
    bind: (service) => {
      target = service;
    },
    on: (call) =>
      target === null
        ? Promise.reject(new Error(`${describe} was reached before it started`))
        : call(target),
  };
}
