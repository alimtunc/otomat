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
