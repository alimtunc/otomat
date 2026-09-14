import { isEditableTarget } from "@otomat/ui";
import { useEffect, useEffectEvent } from "react";

export function useNewIssueShortcut(onNewIssue: () => void) {
  const fire = useEffectEvent(onNewIssue);
  // otomat-allow-effect: subscribe a global keydown listener for the New issue shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented || e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (
        document.querySelector(
          '[role="dialog"]:not([hidden]):not([data-closed]), [role="alertdialog"]:not([hidden]):not([data-closed]), [aria-modal="true"]:not([hidden]):not([data-closed]), dialog[open]',
        )
      )
        return;
      e.preventDefault();
      fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
