import { isEditableTarget } from "@otomat/ui";
import type { ProjectTab } from "@web/components/shell/project-tabs/visible-tabs";
import { useEffect, useEffectEvent } from "react";

function targetIndex(event: KeyboardEvent, count: number, active: number): number | null {
  if (count === 0) return null;
  if (event.key === "Tab") return (active + (event.shiftKey ? -1 : 1) + count) % count;
  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 1 || digit > count) return null;
  return digit - 1;
}

export function useProjectTabShortcuts(
  tabs: ProjectTab[],
  activeKey: string | undefined,
  onSelect: (key: string) => void,
): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) return;
    if (isEditableTarget(event.target)) return;
    const index = targetIndex(
      event,
      tabs.length,
      tabs.findIndex((tab) => tab.id === activeKey),
    );
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
