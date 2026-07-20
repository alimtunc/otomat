import type { DiffFileContract } from "@otomat/domain";
import { adjacentFile, changeBlockRows, clampHunkIndex } from "@web/components/runs/diff/diff-nav";
import { isEditableTarget } from "@web/lib/keyboard";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

export interface DiffKeyboardNavOptions {
  enabled: boolean;
  files: readonly DiffFileContract[];
  activePath: string | null;
  /** Container holding the rendered file cards; hunk rows are queried inside it. */
  cardsRef: RefObject<HTMLElement | null>;
  onJumpToFile: (file: DiffFileContract) => void;
  onToggleReviewed: (path: string) => void;
  onExit: () => void;
}

function focusAndReveal(row: HTMLElement): void {
  row.tabIndex = -1;
  row.scrollIntoView({ block: "center" });
  row.focus({ preventScroll: true });
}

/** j/k file stepping, n/p hunk stepping, v reviewed toggle, Escape back to the cockpit. */
export function useDiffKeyboardNav(options: DiffKeyboardNavOptions): void {
  const hunkIndexRef = useRef(-1);

  const handleKey = useEffectEvent((e: KeyboardEvent) => {
    const { enabled, files, activePath, cardsRef, onJumpToFile, onToggleReviewed, onExit } =
      options;
    if (!enabled || e.defaultPrevented || e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;
    if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]') !== null) return;

    switch (e.key) {
      case "j":
      case "k": {
        const file = adjacentFile(files, activePath, e.key === "j" ? 1 : -1);
        if (file !== null) {
          hunkIndexRef.current = -1;
          onJumpToFile(file);
        }
        e.preventDefault();
        return;
      }
      case "n":
      case "p": {
        const container = cardsRef.current;
        if (container === null) return;
        const hunks = changeBlockRows(container);
        const next = clampHunkIndex(hunkIndexRef.current, e.key === "n" ? 1 : -1, hunks.length);
        if (next !== -1) {
          hunkIndexRef.current = next;
          focusAndReveal(hunks[next]);
        }
        e.preventDefault();
        return;
      }
      case "v": {
        const path = activePath ?? files[0]?.path;
        if (path !== undefined) onToggleReviewed(path);
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
