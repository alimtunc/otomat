import { createStore } from "@tanstack/react-store";
import {
  readDiffPrefs,
  writeDiffPrefs,
  type DiffPrefs,
} from "@web/components/runs/diff/prefs/prefs";

export const diffPrefsStore = createStore(readDiffPrefs(), ({ setState, get }) => ({
  set(patch: Partial<DiffPrefs>): void {
    const next = { ...get(), ...patch };
    setState(() => next);
    writeDiffPrefs(next);
  },
}));
