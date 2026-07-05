/**
 * Normalizes a timestamp to a `Date`. An existing `Date` is passed through unchanged
 * (not cloned), so callers must not mutate the result; an unparseable string yields an Invalid Date.
 */
export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}
