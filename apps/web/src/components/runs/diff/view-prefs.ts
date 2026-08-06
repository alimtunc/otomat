import { readStored, writeStored } from "@web/lib/storage";

export type DiffViewMode = "unified" | "split";
/** How the changed-file sidebar is laid out: a flat list, or real folders. */
export type DiffBrowserMode = "files" | "tree";

const VIEW_MODE_KEY = "otomat.diff-view-mode";
const BROWSER_MODE_KEY = "otomat.diff-browser-mode";

export function readDiffViewMode(storage?: Pick<Storage, "getItem"> | null): DiffViewMode {
  return readStored(VIEW_MODE_KEY, storage) === "split" ? "split" : "unified";
}

export function writeDiffViewMode(
  mode: DiffViewMode,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(VIEW_MODE_KEY, mode, storage);
}

export function readDiffBrowserMode(storage?: Pick<Storage, "getItem"> | null): DiffBrowserMode {
  return readStored(BROWSER_MODE_KEY, storage) === "tree" ? "tree" : "files";
}

export function writeDiffBrowserMode(
  mode: DiffBrowserMode,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(BROWSER_MODE_KEY, mode, storage);
}
