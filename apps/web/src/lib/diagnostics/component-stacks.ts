const stacks = new WeakMap<object, string>();
const listeners = new Set<() => void>();
let version = 0;

function keyOf(error: unknown): object | null {
  return typeof error === "object" && error !== null ? error : null;
}

/**
 * React only reports a component stack in the commit phase, after the error UI has already
 * rendered, and the router's boundary does not pass it on. Keeping it here — keyed by the error
 * itself, so nothing is retained once the error is gone — is what lets the report name the
 * component that failed instead of only the library frame that threw.
 */
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
