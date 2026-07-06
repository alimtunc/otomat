/** Defensive readers over untrusted provider frames: never throw, return null/[] when the shape is not the expected one. */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseJsonRecord(line: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(line));
  } catch {
    return null;
  }
}
