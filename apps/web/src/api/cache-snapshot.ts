import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { asNumber, asRecord } from "@web/lib/coerce";
import { readStoredJson, writeStored, type ScopedStorage } from "@web/lib/storage";

const SNAPSHOT_KEY = "otomat.query-snapshot";
const MAX_AGE_MS = 86_400_000;
const WRITE_DELAY_MS = 30_000;

const SNAPSHOT_ROOTS = new Set(["activity", "inbox", "issues", "projects", "reviews", "runs"]);

/** The shell's catalog keys are the only host-less entries kept. */
function isSnapshotEntry(queryKey: readonly unknown[]): boolean {
  const [first, second] = queryKey;
  // The live host status stays out: a restored one would name the wrong active host until the IPC read answers.
  if (first === "execution-host") return second === "projects" || second === "repositories";
  return SNAPSHOT_ROOTS.has(String(second));
}

export function saveQuerySnapshot(client: QueryClient, storage?: ScopedStorage | null): void {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" && isSnapshotEntry(query.queryKey),
    shouldDehydrateMutation: () => false,
  });
  writeStored(SNAPSHOT_KEY, JSON.stringify({ saved_at: Date.now(), state }), storage);
}

export function restoreQuerySnapshot(client: QueryClient, storage?: ScopedStorage | null): void {
  const stored = readStoredJson(SNAPSHOT_KEY, asRecord, storage);
  if (stored === null) return;
  const savedAt = asNumber(stored["saved_at"]);
  const state = asRecord(stored["state"]);
  if (savedAt === null || state === null || Date.now() - savedAt > MAX_AGE_MS) return;
  hydrate(client, state);
  // A restored `dataUpdatedAt` can satisfy `staleTime`, so invalidate to force a revalidation.
  void client.invalidateQueries({ predicate: (query) => isSnapshotEntry(query.queryKey) });
}

export function attachQuerySnapshot(client: QueryClient): void {
  restoreQuerySnapshot(client);

  const save = (): void => saveQuerySnapshot(client);
  // A crash fires no lifecycle event, so a periodic write bounds what an abnormal exit can lose.
  let pending: ReturnType<typeof setTimeout> | null = null;
  client.getQueryCache().subscribe((event) => {
    if (pending !== null || !isSnapshotEntry(event.query.queryKey)) return;
    pending = setTimeout(() => {
      pending = null;
      save();
    }, WRITE_DELAY_MS);
  });
  window.addEventListener("pagehide", save);
}
