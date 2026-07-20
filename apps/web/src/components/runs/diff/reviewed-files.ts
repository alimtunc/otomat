import { readStored, writeStored } from "@web/lib/storage";

const REVIEWED_KEY = "otomat.reviewed-files";
const MAX_REVIEWED_RUNS = 40;

interface ReviewedFilesEntry {
  sha: string;
  paths: string[];
}

type ReviewedFilesByRun = Record<string, ReviewedFilesEntry>;

function isReviewedFilesEntry(value: unknown): value is ReviewedFilesEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.sha === "string" &&
    Array.isArray(entry.paths) &&
    entry.paths.every((path) => typeof path === "string")
  );
}

function readAllReviewedFiles(storage?: Pick<Storage, "getItem"> | null): ReviewedFilesByRun {
  const raw = readStored(REVIEWED_KEY, storage);
  if (raw === null) return {};
  let parsed: unknown;
  try {
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
  storage?: Pick<Storage, "getItem"> | null,
): ReadonlySet<string> {
  const entry = readAllReviewedFiles(storage)[runId];
  if (entry === undefined || entry.sha !== sha) return new Set();
  return new Set(entry.paths);
}

export function writeReviewedFiles(
  runId: string,
  sha: string,
  paths: ReadonlySet<string>,
  storage?: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null,
): void {
  const byRun = readAllReviewedFiles(storage);
  delete byRun[runId];
  if (paths.size > 0) byRun[runId] = { sha, paths: [...paths] };
  const runIds = Object.keys(byRun);
  for (const staleRunId of runIds.slice(0, Math.max(0, runIds.length - MAX_REVIEWED_RUNS))) {
    delete byRun[staleRunId];
  }
  writeStored(REVIEWED_KEY, JSON.stringify(byRun), storage);
}
