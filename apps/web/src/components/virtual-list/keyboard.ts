export function virtualIndexOf(
  target: EventTarget,
  root: HTMLElement | null,
  count: number,
): number | null {
  if (!(target instanceof HTMLElement)) return null;
  let item = target.closest<HTMLElement>("[data-virtual-index]");
  while (item && item.parentElement?.closest("[data-virtual-list]") !== root) {
    item = item.parentElement?.closest<HTMLElement>("[data-virtual-index]") ?? null;
  }
  const index = Number(item?.dataset.virtualIndex);
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}

export function keyboardTarget(
  key: string,
  index: number,
  count: number,
  horizontal: boolean,
): number | null {
  const previous = horizontal ? "ArrowLeft" : "ArrowUp";
  const next = horizontal ? "ArrowRight" : "ArrowDown";
  let target: number | null = null;
  if (key === "Home") target = 0;
  if (key === "End") target = count - 1;
  if (key === previous) target = index - 1;
  if (key === next) target = index + 1;
  return target === null || target < 0 || target >= count ? null : target;
}
