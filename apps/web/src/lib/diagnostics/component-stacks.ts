const stacks = new WeakMap<object, string>();
const listeners = new Set<() => void>();
let version = 0;

function keyOf(error: unknown): object | null {
  return typeof error === "object" && error !== null ? error : null;
}

/** React reports a component stack only in the commit phase and the router's boundary drops it, so it is kept here. */
export function recordComponentStack(error: unknown, componentStack: string | null): void {
  const key = keyOf(error);
  if (key === null || componentStack === null || componentStack === "") return;
  stacks.set(key, componentStack);
  version += 1;
  for (const listener of listeners) listener();
}

export function componentStackFor(error: unknown): string | null {
  const key = keyOf(error);
  return key === null ? null : (stacks.get(key) ?? null);
}

export function subscribeComponentStacks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function componentStacksVersion(): number {
  return version;
}
