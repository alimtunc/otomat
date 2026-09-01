import { asRecord } from "@web/lib/coerce";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStored(
  key: string,
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): string | null {
  if (storage === null) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(
  key: string,
  value: string,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* storage unavailable; the in-memory value still applies */
  }
}

export type ScopedStorage = Pick<Storage, "getItem" | "setItem">;

export function readStoredJson<T>(
  key: string,
  parse: (raw: unknown) => T,
  storage?: Pick<Storage, "getItem"> | null,
): T {
  const raw = readStored(key, storage);
  if (raw === null) return parse(null);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return parse(null);
  }
  return parse(parsed);
}

/** One key per concern, one bucket per project inside it, so a project's entries never leak into another's. */
function readBuckets(key: string, storage?: ScopedStorage | null): Record<string, unknown> {
  return readStoredJson(key, (raw) => asRecord(raw) ?? {}, storage);
}

export function readScoped<T>(
  key: string,
  scope: string,
  parse: (raw: unknown) => T,
  storage?: ScopedStorage | null,
): T {
  return parse(readBuckets(key, storage)[scope]);
}

export function writeScoped<T>(
  key: string,
  scope: string,
  value: T,
  storage?: ScopedStorage | null,
): void {
  writeStored(key, JSON.stringify({ ...readBuckets(key, storage), [scope]: value }), storage);
}
