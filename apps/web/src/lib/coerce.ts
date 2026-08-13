export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

export function asMember<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((option) => option === value) ?? null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? { ...value } : null;
}

/** Deduplicated and sorted, so two equal selections compare equal wherever they were built. */
export function normalizedSelection(value: unknown): string[] {
  return [...new Set(asStrings(value))].toSorted();
}

export function normalizedMembers<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return normalizedSelection(value)
    .map((entry) => asMember(entry, allowed))
    .filter((entry): entry is T => entry !== null);
}
