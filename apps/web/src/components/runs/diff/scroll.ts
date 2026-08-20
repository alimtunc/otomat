export type RevealBlock = "start" | "center";

/**
 * A clipping ancestor is not the element that scrolls, so both the reveal and the highlight
 * latch resolve the real one rather than assuming the panel they were rendered in.
 */
export function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll") return parent;
  }
  return null;
}

/** The scrollTop that puts `element` at the container's top edge, under whatever sticks there. */
function scrollTopForStart(container: HTMLElement, element: HTMLElement): number {
  const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  return container.scrollTop + offset - container.clientTop;
}

/**
 * Scrolls the element's own container and nothing above it: `scrollIntoView` also moves every
 * scrollable ancestor, which is what slides the diff toolbar out from over a file's header.
 */
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
