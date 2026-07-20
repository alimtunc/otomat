import type { DiffFileContract } from "@otomat/domain";
import { isEditableTarget } from "@otomat/ui";
import {
  adjacentFile,
  changeBlockRows,
  clampBlockIndex,
  revealAndFocus,
} from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/file-card.utils";
import { useEffect, useEffectEvent } from "react";

export interface DiffKeyboardNavOptions {
  enabled: boolean;
  files: readonly DiffFileContract[];
  activePath: string | null;
  onJumpToFile: (file: DiffFileContract) => void;
  onToggleReviewed: (path: string) => void;
  onExit: () => void;
}

export function useDiffKeyboardNav(options: DiffKeyboardNavOptions): void {
  const handleKey = useEffectEvent((e: KeyboardEvent) => {
    const { enabled, files, activePath, onJumpToFile, onToggleReviewed, onExit } = options;
    if (!enabled || e.defaultPrevented || e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;
    if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]') !== null) return;

    const focusedPath = activePath ?? files[0]?.path ?? null;

    switch (e.key) {
      case "j":
      case "k": {
        const file = adjacentFile(files, activePath, e.key === "j" ? 1 : -1);
        if (file !== null) onJumpToFile(file);
        e.preventDefault();
        return;
      }
      case "n":
      case "p": {
        if (focusedPath === null) return;
        e.preventDefault();
        if (activePath === null) onJumpToFile(files[0]);
        const card = document.getElementById(diffFileDomId({ path: focusedPath }));
        if (card === null) return;
        const blocks = changeBlockRows(card);
        const focused = document.activeElement;
        const current = focused instanceof HTMLElement ? blocks.indexOf(focused) : -1;
        const next = clampBlockIndex(current, e.key === "n" ? 1 : -1, blocks.length);
        if (next !== -1) revealAndFocus(blocks[next], "center");
        return;
      }
      case "v": {
        if (focusedPath !== null) onToggleReviewed(focusedPath);
        e.preventDefault();
        return;
      }
      case "Escape": {
        onExit();
        e.preventDefault();
        return;
      }
      default:
    }
  });

  // otomat-allow-effect: subscribe the diff view's global keyboard-navigation listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKey(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
