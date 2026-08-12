import { readStored, writeStored } from "@web/lib/storage";

export type DiffViewMode = "unified" | "split";
export type DiffBrowserMode = "files" | "tree";
export type DiffSortMode = "path" | "changes";

export interface DiffPrefs {
  mode: DiffViewMode;
  browser: DiffBrowserMode;
  sort: DiffSortMode;
  wrap: boolean;
  stats: boolean;
  hideReviewed: boolean;
}

export const DEFAULT_DIFF_PREFS: DiffPrefs = {
  mode: "unified",
  browser: "files",
  sort: "path",
  wrap: false,
  stats: true,
  hideReviewed: false,
};

const PREFS_KEY = "otomat.diff-prefs";

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readDiffPrefs(storage?: Pick<Storage, "getItem"> | null): DiffPrefs {
  const raw = readStored(PREFS_KEY, storage);
  if (raw === null) return DEFAULT_DIFF_PREFS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_DIFF_PREFS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_DIFF_PREFS;
  const stored: Record<string, unknown> = { ...parsed };
  return {
    mode: pick(stored.mode, ["unified", "split"], DEFAULT_DIFF_PREFS.mode),
    browser: pick(stored.browser, ["files", "tree"], DEFAULT_DIFF_PREFS.browser),
    sort: pick(stored.sort, ["path", "changes"], DEFAULT_DIFF_PREFS.sort),
    wrap: flag(stored.wrap, DEFAULT_DIFF_PREFS.wrap),
    stats: flag(stored.stats, DEFAULT_DIFF_PREFS.stats),
    hideReviewed: flag(stored.hideReviewed, DEFAULT_DIFF_PREFS.hideReviewed),
  };
}

export function writeDiffPrefs(prefs: DiffPrefs, storage?: Pick<Storage, "setItem"> | null): void {
  writeStored(PREFS_KEY, JSON.stringify(prefs), storage);
}
