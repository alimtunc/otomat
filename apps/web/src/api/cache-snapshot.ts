import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { indexedDbSnapshotStore, type SnapshotStore } from "@web/api/snapshot-store";
import { asNumber, asRecord } from "@web/lib/coerce";
import { removeStored } from "@web/lib/storage";

const LEGACY_SNAPSHOT_KEY = "otomat.query-snapshot";
const MAX_AGE_MS = 86_400_000;
const WRITE_DELAY_MS = 30_000;
const MAX_SNAPSHOT_CHARACTERS = 24_000_000;

const SNAPSHOT_ROOTS = new Set([
  "activity",
  "conversations",
  "inbox",
  "projects",
  "reviews",
  "usage",
  "workspaces",
]);
const LINEAR_PANES = new Set(["editor", "comments", "attachments"]);

function isSnapshotEntry(queryKey: readonly unknown[]): boolean {
  const [first, second, third, fourth] = queryKey;
  if (first === "execution-host") return second === "projects" || second === "repositories";
  if (second === "issues") return third !== "project" && third !== "search";
  if (second === "runs") return third === "catalog" || asRecord(third) !== null;
  // The run's own detail only: its subtree is recomputed from git on every read.
  if (second === "run") return queryKey.length === 3;
  if (second === "pull-request") return queryKey.length === 3 || fourth === "overview";
  if (second === "linear") return LINEAR_PANES.has(String(third));
  return SNAPSHOT_ROOTS.has(String(second));
}

export async function saveQuerySnapshot(
  client: QueryClient,
  store: SnapshotStore = indexedDbSnapshotStore,
): Promise<void> {
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
  await store.set(
    `{"saved_at":${Date.now()},"state":{"mutations":[],"queries":[${queries.join(",")}]}}`,
  );
}

export async function restoreQuerySnapshot(
  client: QueryClient,
  store: SnapshotStore = indexedDbSnapshotStore,
): Promise<void> {
  const raw = await store.get();
  if (raw === null) return;
  const stored = asRecord(JSON.parse(raw));
  const savedAt = asNumber(stored?.["saved_at"]);
  const state = asRecord(stored?.["state"]);
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

/** Resolves once the stored snapshot is in the cache, so the first paint already shows it. */
export async function attachQuerySnapshot(
  client: QueryClient,
  store: SnapshotStore = indexedDbSnapshotStore,
): Promise<void> {
  removeStored(LEGACY_SNAPSHOT_KEY);
  try {
    await restoreQuerySnapshot(client, store);
  } catch (error) {
    // An unreadable snapshot is overwritten by the next save; this session starts from the daemon.
    reportError(error);
  }
  let dirty = false;
  const save = (): void => {
    if (!dirty) return;
    dirty = false;
    saveQuerySnapshot(client, store).catch(reportError);
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
  // An IndexedDB write can outlive a hidden page but not an unloaded one, so hiding saves first.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}
