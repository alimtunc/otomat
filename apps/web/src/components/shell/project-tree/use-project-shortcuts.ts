import { isEditableTarget, isOverlayTarget } from "@otomat/ui";
import { useEffect, useEffectEvent } from "react";

function targetIndex(event: KeyboardEvent, count: number): number | null {
  if (count === 0) return null;
  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 1 || digit > count) return null;
  return digit - 1;
}

export function useProjectShortcuts(
  projects: { id: string }[],
  activeKey: string | undefined,
  onSelect: (key: string) => void,
): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) return;
    if (isEditableTarget(event.target) || isOverlayTarget(event.target)) return;
    const index = targetIndex(event, projects.length);
    if (index === null) return;
    const project = projects[index];
    if (project === undefined) return;
    event.preventDefault();
    if (project.id !== activeKey) onSelect(project.id);
  });

  // otomat-allow-effect: subscribe a global keydown listener for the project shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
