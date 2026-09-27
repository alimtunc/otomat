import { isEditableTarget } from "@otomat/ui";
import { useEffect, useEffectEvent } from "react";

function targetIndex(event: KeyboardEvent, count: number): number | null {
  if (count === 0) return null;
  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 1 || digit > count) return null;
  return digit - 1;
}

export function useProjectTabShortcuts(
  tabs: { id: string }[],
  activeKey: string | undefined,
  onSelect: (key: string) => void,
): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) return;
    if (isEditableTarget(event.target)) return;
    if (event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]'))
      return;
    const index = targetIndex(event, tabs.length);
    if (index === null) return;
    const tab = tabs[index];
    if (tab === undefined) return;
    event.preventDefault();
    if (tab.id !== activeKey) onSelect(tab.id);
  });

  // otomat-allow-effect: subscribe a global keydown listener for the project tab shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
