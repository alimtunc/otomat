export function combineFailures<T>(failures: readonly T[], message: string): T | AggregateError {
  if (failures.length === 0) {
    throw new TypeError("At least one failure is required.");
  }
  return failures.length === 1 ? failures[0] : new AggregateError(failures, message);
}
