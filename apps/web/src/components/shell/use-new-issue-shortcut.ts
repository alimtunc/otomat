import { useEffect, useEffectEvent } from "react";

export function useNewIssueShortcut(onNewIssue: () => void) {
  const fire = useEffectEvent(onNewIssue);
  // otomat-allow-effect: subscribe a global keydown listener for the New issue shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
