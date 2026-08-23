export type RevealBlock = "start" | "center";

export function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll") return parent;
  }
  return null;
}

function scrollTopForStart(container: HTMLElement, element: HTMLElement): number {
  const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  return container.scrollTop + offset - container.clientTop;
}

/** `scrollIntoView` also moves every scrollable ancestor, sliding the diff toolbar out from over a file's header. */
export function scrollIntoContainer(element: HTMLElement, block: RevealBlock): void {
  const container = scrollParent(element);
  if (container === null) {
    element.scrollIntoView({ block });
    return;
  }
  const start = scrollTopForStart(container, element);
  container.scrollTop =
    block === "center"
      ? start - Math.max(0, (container.clientHeight - element.getBoundingClientRect().height) / 2)
      : start;
}
