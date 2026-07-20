export type DiffViewMode = "unified" | "split";

const VIEW_MODE_KEY = "otomat.diff-view-mode";
const REVIEWED_KEY = "otomat.reviewed-files";
const MAX_REVIEWED_RUNS = 40;

export interface ReviewedFilesEntry {
  sha: string;
  paths: string[];
}

type ReviewedFilesByRun = Record<string, ReviewedFilesEntry>;

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDiffViewMode(
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): DiffViewMode {
  if (storage === null) return "unified";
  try {
    const stored = storage.getItem(VIEW_MODE_KEY);
    return stored === "split" ? "split" : "unified";
  } catch {
    return "unified";
  }
}

export function writeDiffViewMode(
  mode: DiffViewMode,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* storage unavailable; the in-memory mode still applies */
  }
}

function isReviewedFilesEntry(value: unknown): value is ReviewedFilesEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.sha === "string" &&
    Array.isArray(entry.paths) &&
    entry.paths.every((path) => typeof path === "string")
  );
}

function readAllReviewedFiles(storage: Pick<Storage, "getItem">): ReviewedFilesByRun {
  let parsed: unknown;
  try {
    const raw = storage.getItem(REVIEWED_KEY);
    if (raw === null) return {};
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const byRun: ReviewedFilesByRun = {};
  for (const [runId, entry] of Object.entries(parsed)) {
    if (isReviewedFilesEntry(entry)) byRun[runId] = entry;
  }
  return byRun;
}

/** Reviewed paths for a run, valid only for the given diff sha: a new diff never inherits old marks. */
export function readReviewedFiles(
  runId: string,
  sha: string,
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): ReadonlySet<string> {
  if (storage === null) return new Set();
  const entry = readAllReviewedFiles(storage)[runId];
  if (entry === undefined || entry.sha !== sha) return new Set();
  return new Set(entry.paths);
}

export function writeReviewedFiles(
  runId: string,
  sha: string,
  paths: ReadonlySet<string>,
  storage: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null = browserStorage(),
): void {
  if (storage === null) return;
  const byRun = readAllReviewedFiles(storage);
  delete byRun[runId];
  if (paths.size > 0) byRun[runId] = { sha, paths: [...paths] };
  const runIds = Object.keys(byRun);
  for (const staleRunId of runIds.slice(0, Math.max(0, runIds.length - MAX_REVIEWED_RUNS))) {
    delete byRun[staleRunId];
  }
  try {
    storage.setItem(REVIEWED_KEY, JSON.stringify(byRun));
  } catch {
    /* storage unavailable; the in-memory marks still apply */
  }
}
