import { serializeByKey } from "#serialize";

const sequences = new Map<string, Promise<unknown>>();

/** Interleaved in one working directory, a revision check no longer guards the write after it, and `write-tree` dies on another command's `index.lock`. */
export function inCheckout<T>(path: string, operation: () => Promise<T>): Promise<T> {
  return serializeByKey(sequences, path, operation);
}
