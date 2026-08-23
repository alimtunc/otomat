export interface ScrollControl {
  setContentHeight: (height: number) => void;
  setViewportHeight: (height: number) => void;
  dragTo: (top: number) => void;
  top: () => number;
  maxTop: () => number;
  lastBehavior: () => ScrollBehavior | undefined;
}

/** happy-dom has no layout, so every move — the component's own `scrollTop` write included — notifies scroll listeners as a browser does. */
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
