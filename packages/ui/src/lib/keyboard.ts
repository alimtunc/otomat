export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function isOverlayTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null
  );
}
