/** A bound that is not a plain non-negative integer is ignored, so the read falls back to its default. */
export function nonNegativeInt(raw: string | undefined): number | undefined {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined;
}
