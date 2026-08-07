export interface ScrollControl {
  /** Grow or shrink the scrolled content, as a new message or a taller row would. */
  setContentHeight: (height: number) => void;
  /** Grow or shrink the visible box, as the queued banner or a taller composer would. */
  setViewportHeight: (height: number) => void;
  /** Move the scrollbar the way a reader does: the browser notifies listeners afterwards. */
  dragTo: (top: number) => void;
  top: () => number;
  maxTop: () => number;
  /** Behaviour of the last `scrollTo` the component asked for; undefined until it asks. */
  lastBehavior: () => ScrollBehavior | undefined;
}

/**
 * happy-dom has no layout, so a scroll container only has the geometry a test gives it.
 * Every move — the component's own `scrollTop` write included — notifies scroll listeners,
 * as a browser does.
 */
export function controlScroll(
  element: HTMLElement,
  viewportHeight: number,
  contentHeight: number,
): ScrollControl {
  let viewport = viewportHeight;
  let content = contentHeight;
  let top = 0;
  let behavior: ScrollBehavior | undefined;

  const maxTop = () => Math.max(0, content - viewport);
  const move = (next: number) => {
    top = Math.min(Math.max(next, 0), maxTop());
    element.dispatchEvent(new Event("scroll"));
  };
  const scrollTo = (to: ScrollToOptions) => {
    behavior = to.behavior;
    move(to.top ?? 0);
  };

  Object.defineProperties(element, {
    clientHeight: { configurable: true, get: () => viewport },
    scrollHeight: { configurable: true, get: () => content },
    scrollTop: { configurable: true, get: () => top, set: move },
    scrollTo: { configurable: true, value: scrollTo },
  });

  return {
    setContentHeight: (height) => {
      content = height;
    },
    setViewportHeight: (height) => {
      viewport = height;
    },
    dragTo: move,
    top: () => top,
    maxTop,
    lastBehavior: () => behavior,
  };
}
