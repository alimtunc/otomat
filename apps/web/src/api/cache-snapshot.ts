import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { asNumber, asRecord } from "@web/lib/coerce";
import { readStoredJson, writeStored, type ScopedStorage } from "@web/lib/storage";

const SNAPSHOT_KEY = "otomat.query-snapshot";
const MAX_AGE_MS = 86_400_000;
const WRITE_DELAY_MS = 30_000;
const MAX_SNAPSHOT_CHARACTERS = 4_000_000;

const SNAPSHOT_ROOTS = new Set(["activity", "inbox", "issues", "projects", "reviews", "runs"]);

function isSnapshotEntry(queryKey: readonly unknown[]): boolean {
  const [first, second, third] = queryKey;
  if (first === "execution-host") return second === "projects" || second === "repositories";
  if (second === "issues") return third !== "project" && third !== "search";
  if (second === "runs") return third === "catalog";
  return SNAPSHOT_ROOTS.has(String(second));
}

export function saveQuerySnapshot(client: QueryClient, storage?: ScopedStorage | null): void {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" && isSnapshotEntry(query.queryKey),
    shouldDehydrateMutation: () => false,
  });
  let remaining = MAX_SNAPSHOT_CHARACTERS;
  const queries: string[] = [];
  for (const query of state.queries.toSorted(
    (a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt,
  )) {
    const serialized = JSON.stringify(query);
    if (serialized.length > remaining) continue;
    queries.push(serialized);
    remaining -= serialized.length + 1;
  }
  writeStored(
    SNAPSHOT_KEY,
    `{"saved_at":${Date.now()},"state":{"mutations":[],"queries":[${queries.join(",")}]}}`,
    storage,
  );
}

export function restoreQuerySnapshot(client: QueryClient, storage?: ScopedStorage | null): void {
  const stored = readStoredJson(SNAPSHOT_KEY, asRecord, storage);
  if (stored === null) return;
  const savedAt = asNumber(stored["saved_at"]);
  const state = asRecord(stored["state"]);
  if (savedAt === null || state === null || Date.now() - savedAt > MAX_AGE_MS) return;
  const queries = Array.isArray(state["queries"])
    ? state["queries"].filter((query: unknown) => {
        const key = asRecord(query)?.["queryKey"];
        return Array.isArray(key) && isSnapshotEntry(key);
      })
    : [];
  hydrate(client, { mutations: [], queries });
  // A restored `dataUpdatedAt` can satisfy `staleTime`, so invalidate to force a revalidation.
  void client.invalidateQueries({ predicate: (query) => isSnapshotEntry(query.queryKey) });
}

export function attachQuerySnapshot(client: QueryClient): void {
  restoreQuerySnapshot(client);

  let dirty = false;
  const save = (): void => {
    if (!dirty) return;
    dirty = false;
    saveQuerySnapshot(client);
  };
  let pending: ReturnType<typeof setTimeout> | null = null;
  client.getQueryCache().subscribe((event) => {
    if (!isSnapshotEntry(event.query.queryKey)) return;
    if (event.type !== "removed" && !(event.type === "updated" && event.action.type === "success"))
      return;
    dirty = true;
    if (pending !== null) return;
    pending = setTimeout(() => {
      pending = null;
      save();
    }, WRITE_DELAY_MS);
  });
  window.addEventListener("pagehide", save);
}
