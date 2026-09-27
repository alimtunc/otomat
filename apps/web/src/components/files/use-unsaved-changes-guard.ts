import { useBlocker } from "@tanstack/react-router";
import { CONTEXT_NAVIGATION_EVENT } from "@web/lib/context-navigation";
import { useEffect, useEffectEvent } from "react";
import { flushSync } from "react-dom";

export function useUnsavedChangesGuard(dirty: boolean, onDiscard: () => void): void {
  const confirm = (): boolean => {
    if (!dirty) return true;
    if (!window.confirm("This file has unsaved changes. Leave and discard them?")) return false;
    // The router blocker re-reads `dirty` on the navigation that follows this confirm.
    flushSync(onDiscard);
    return true;
  };
  useBlocker({ shouldBlockFn: () => !confirm(), enableBeforeUnload: dirty });
  const onContextChange = useEffectEvent((event: Event) => {
    if (!event.defaultPrevented && !confirm()) event.preventDefault();
  });
  // otomat-allow-effect: project and host switches can replace an editor without changing its pathname.
  useEffect(() => {
    const handle = (event: Event) => onContextChange(event);
    window.addEventListener(CONTEXT_NAVIGATION_EVENT, handle);
    return () => window.removeEventListener(CONTEXT_NAVIGATION_EVENT, handle);
  }, []);
}
