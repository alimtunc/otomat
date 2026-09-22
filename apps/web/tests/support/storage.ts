import type { SnapshotStore } from "@web/api/snapshot-store";

export function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

export function memorySnapshotStore(): SnapshotStore & { value: string | null } {
  const store: SnapshotStore & { value: string | null } = {
    value: null,
    get: async () => store.value,
    set: async (value: string) => {
      store.value = value;
    },
  };
  return store;
}
