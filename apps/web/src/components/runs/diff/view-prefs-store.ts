import { createStore } from "@tanstack/react-store";
import {
  readDiffViewMode,
  writeDiffViewMode,
  type DiffViewMode,
} from "@web/components/runs/diff/view-prefs";

export const diffViewModeStore = createStore(readDiffViewMode(), ({ setState }) => ({
  set(mode: DiffViewMode): void {
    setState(() => mode);
    writeDiffViewMode(mode);
  },
}));
