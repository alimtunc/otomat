import { readStored, writeStored } from "@web/lib/storage";

export type DiffViewMode = "unified" | "split";

const VIEW_MODE_KEY = "otomat.diff-view-mode";

export function readDiffViewMode(storage?: Pick<Storage, "getItem"> | null): DiffViewMode {
  return readStored(VIEW_MODE_KEY, storage) === "split" ? "split" : "unified";
}

export function writeDiffViewMode(
  mode: DiffViewMode,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(VIEW_MODE_KEY, mode, storage);
}
