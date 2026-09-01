import { REVIEW_COMMENT_DESTINATIONS, type ReviewCommentDestination } from "@otomat/domain";
import { asBoolean, asMember, asRecord } from "@web/lib/coerce";
import { readStoredJson, writeStored } from "@web/lib/storage";

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
  commentDestination: ReviewCommentDestination;
}

export const DEFAULT_DIFF_PREFS: DiffPrefs = {
  mode: "unified",
  browser: "files",
  sort: "path",
  wrap: false,
  stats: true,
  hideReviewed: false,
  commentDestination: "agent",
};

const PREFS_KEY = "otomat.diff-prefs";

export function readDiffPrefs(storage?: Pick<Storage, "getItem"> | null): DiffPrefs {
  const stored = readStoredJson(PREFS_KEY, asRecord, storage);
  if (stored === null) return DEFAULT_DIFF_PREFS;
  return {
    mode: asMember(stored.mode, ["unified", "split"] as const) ?? DEFAULT_DIFF_PREFS.mode,
    browser: asMember(stored.browser, ["files", "tree"] as const) ?? DEFAULT_DIFF_PREFS.browser,
    sort: asMember(stored.sort, ["path", "changes"] as const) ?? DEFAULT_DIFF_PREFS.sort,
    wrap: asBoolean(stored.wrap) ?? DEFAULT_DIFF_PREFS.wrap,
    stats: asBoolean(stored.stats) ?? DEFAULT_DIFF_PREFS.stats,
    hideReviewed: asBoolean(stored.hideReviewed) ?? DEFAULT_DIFF_PREFS.hideReviewed,
    commentDestination:
      asMember(stored.commentDestination, REVIEW_COMMENT_DESTINATIONS) ??
      DEFAULT_DIFF_PREFS.commentDestination,
  };
}

export function writeDiffPrefs(prefs: DiffPrefs, storage?: Pick<Storage, "setItem"> | null): void {
  writeStored(PREFS_KEY, JSON.stringify(prefs), storage);
}
