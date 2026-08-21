import { useEffect, useRef, type RefObject } from "react";

/** Takes Cmd/Ctrl+F from the browser, whose find cannot reach a collapsed or unrendered hunk. */
export function useFindShortcut(): RefObject<HTMLInputElement | null> {
  const field = useRef<HTMLInputElement>(null);

  // otomat-allow-effect: subscribe a global keydown listener for the find shortcut.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "f" || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="dialog"]') !== null) return;
      event.preventDefault();
      field.current?.focus();
      field.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return field;
}
