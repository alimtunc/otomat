import { createStore } from "@tanstack/react-store";
import {
  readDiffBrowserMode,
  readDiffViewMode,
  writeDiffBrowserMode,
  writeDiffViewMode,
  type DiffBrowserMode,
  type DiffViewMode,
} from "@web/components/runs/diff/view-prefs";

export const diffViewModeStore = createStore(readDiffViewMode(), ({ setState }) => ({
  set(mode: DiffViewMode): void {
    setState(() => mode);
    writeDiffViewMode(mode);
  },
}));

export const diffBrowserModeStore = createStore(readDiffBrowserMode(), ({ setState }) => ({
  set(mode: DiffBrowserMode): void {
    setState(() => mode);
    writeDiffBrowserMode(mode);
  },
}));
