import { readStored, writeStored } from "@web/lib/storage";

const REVIEWED_KEY = "otomat.reviewed-files";
const MAX_REVIEWED_RUNS = 40;

/** `path -> the DiffFile.sha that was reviewed`; a file keeps its mark while its patch is unchanged. */
export type ReviewedFingerprints = Record<string, string>;

type ReviewedFilesByRun = Record<string, ReviewedFingerprints>;

function isFingerprints(value: unknown): value is ReviewedFingerprints {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((sha) => typeof sha === "string");
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
    if (isFingerprints(entry)) byRun[runId] = entry;
  }
  return byRun;
}

export function readReviewedFingerprints(
  runId: string,
  storage?: Pick<Storage, "getItem"> | null,
): ReviewedFingerprints {
  return readAllReviewedFiles(storage)[runId] ?? {};
}

export function writeReviewedFingerprints(
  runId: string,
  fingerprints: ReviewedFingerprints,
  storage?: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null,
): void {
  const byRun = readAllReviewedFiles(storage);
  delete byRun[runId];
  if (Object.keys(fingerprints).length > 0) byRun[runId] = fingerprints;
  const runIds = Object.keys(byRun);
  for (const staleRunId of runIds.slice(0, Math.max(0, runIds.length - MAX_REVIEWED_RUNS))) {
    delete byRun[staleRunId];
  }
  writeStored(REVIEWED_KEY, JSON.stringify(byRun), storage);
}

export function reviewedPaths(
  fingerprints: ReviewedFingerprints,
  files: readonly { path: string; sha: string }[],
): ReadonlySet<string> {
  const reviewed = new Set<string>();
  for (const file of files) {
    if (fingerprints[file.path] === file.sha) reviewed.add(file.path);
  }
  return reviewed;
}

/** Drops marks for files no longer in the diff so a long-lived run's entry stays bounded. */
export function pruneFingerprints(
  fingerprints: ReviewedFingerprints,
  files: readonly { path: string }[],
): ReviewedFingerprints {
  const live = new Set(files.map((file) => file.path));
  const kept: ReviewedFingerprints = {};
  for (const [path, sha] of Object.entries(fingerprints)) {
    if (live.has(path)) kept[path] = sha;
  }
  return kept;
}
