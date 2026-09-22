export interface SnapshotStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

const DB_NAME = "otomat";
const STORE_NAME = "query-snapshot";
const SNAPSHOT_ID = "snapshot";

let opened: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.addEventListener("upgradeneeded", () => open.result.createObjectStore(STORE_NAME));
    open.addEventListener("success", () => resolve(open.result));
    open.addEventListener("error", () => reject(open.error));
  });
  return opened;
}

// IndexedDB writes off the main thread and holds far more than localStorage's per-origin quota.
export const indexedDbSnapshotStore: SnapshotStore = {
  async get() {
    const db = await database();
    const read = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(SNAPSHOT_ID);
    const value = await new Promise<unknown>((resolve, reject) => {
      read.addEventListener("success", () => resolve(read.result));
      read.addEventListener("error", () => reject(read.error));
    });
    return typeof value === "string" ? value : null;
  },
  async set(value) {
    const db = await database();
    const write = db.transaction(STORE_NAME, "readwrite");
    write.objectStore(STORE_NAME).put(value, SNAPSHOT_ID);
    await new Promise<void>((resolve, reject) => {
      write.addEventListener("complete", () => resolve());
      write.addEventListener("error", () => reject(write.error));
      write.addEventListener("abort", () => reject(write.error));
    });
  },
};
