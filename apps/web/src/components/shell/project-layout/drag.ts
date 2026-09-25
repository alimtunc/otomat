import type { DragEvent } from "react";

const PROJECT_DRAG_TYPE = "application/x-otomat-project";

export function startProjectDrag(event: DragEvent, key: string): void {
  event.dataTransfer.setData(PROJECT_DRAG_TYPE, key);
  event.dataTransfer.effectAllowed = "move";
}

/** Only a project row's drag is accepted, so a file dragged over the dialog keeps the browser's own handling. */
export function allowProjectDrop(event: DragEvent): void {
  if (event.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) event.preventDefault();
}

export function acceptProjectDrop(event: DragEvent): string | null {
  const key = event.dataTransfer.getData(PROJECT_DRAG_TYPE);
  if (key === "") return null;
  event.preventDefault();
  event.stopPropagation();
  return key;
}
