/** Queued per key, never dropped: two writers on one branch is how a lease turns into a lost commit. */
export function serializeByKey<T>(
  chains: Map<string, Promise<unknown>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const active = chains.get(key);
  const started: Promise<T> = (active ? active.then(operation, operation) : operation()).finally(
    () => {
      if (chains.get(key) === started) chains.delete(key);
    },
  );
  chains.set(key, started);
  return started;
}
