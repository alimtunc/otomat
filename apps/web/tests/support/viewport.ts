type ObserverCallback = (entries: { isIntersecting: boolean; target: Element }[]) => void;

interface Subscription {
  callback: ObserverCallback;
  root: Element | null;
  slack: number;
  targets: Set<Element>;
  delivered: Map<Element, boolean>;
}

export interface ViewportStub {
  /** Lay `cards` out in DOM order down the scroll container, then deliver what changed. */
  layout: (cards: readonly Element[], cardHeight: number) => void;
  /** Move the scrollbar the way a reader does; observers re-evaluate afterwards. */
  scrollTo: (top: number) => void;
  restore: () => void;
}

function verticalSlack(rootMargin: string, rootHeight: number): number {
  const vertical = rootMargin.trim().split(/\s+/)[0] ?? "0px";
  if (vertical.endsWith("%")) return (Number.parseFloat(vertical) / 100) * rootHeight;
  return Number.parseFloat(vertical);
}

/**
 * happy-dom lays nothing out, so an intersection only exists if a test states it. This models
 * the three browser rules the diff cards depend on: a root that is not an ancestor of the target
 * never intersects, a target is clipped by the container that scrolls it, and `rootMargin`
 * widens the observer's own root but never that clip.
 */
export function stubViewport(viewportHeight: number): ViewportStub {
  const subscriptions: Subscription[] = [];
  const boxes = new Map<Element, { top: number; height: number }>();
  const original = globalThis.IntersectionObserver;
  let scrollTop = 0;

  const onScreen = (target: Element): boolean => {
    const box = boxes.get(target);
    if (box === undefined) return false;
    return box.top < scrollTop + viewportHeight && box.top + box.height > scrollTop;
  };

  const intersects = (subscription: Subscription, target: Element): boolean => {
    const box = boxes.get(target);
    if (box === undefined) return false;
    const { root, slack } = subscription;
    if (root === null) return onScreen(target);
    if (!root.contains(target)) return false;
    return box.top < scrollTop + viewportHeight + slack && box.top + box.height > scrollTop - slack;
  };

  const settle = (): void => {
    for (const subscription of subscriptions) {
      const changed = [...subscription.targets]
        .map((target) => ({ isIntersecting: intersects(subscription, target), target }))
        .filter((entry) => subscription.delivered.get(entry.target) !== entry.isIntersecting);
      if (changed.length === 0) continue;
      for (const entry of changed) subscription.delivered.set(entry.target, entry.isIntersecting);
      subscription.callback(changed);
    }
  };

  class Stub {
    private readonly subscription: Subscription;

    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
      this.subscription = {
        callback,
        root: options?.root instanceof Element ? options.root : null,
        slack: verticalSlack(options?.rootMargin ?? "0px", viewportHeight),
        targets: new Set(),
        delivered: new Map(),
      };
      subscriptions.push(this.subscription);
    }

    observe(target: Element): void {
      this.subscription.targets.add(target);
      // A browser reports a newly observed target on the next frame, intersecting or not.
      queueMicrotask(settle);
    }

    disconnect(): void {
      this.subscription.targets.clear();
      this.subscription.delivered.clear();
    }
  }

  Object.assign(globalThis, { IntersectionObserver: Stub });

  return {
    layout(cards, cardHeight) {
      cards.forEach((card, index) =>
        boxes.set(card, { top: index * cardHeight, height: cardHeight }),
      );
      settle();
    },
    scrollTo(top) {
      scrollTop = top;
      settle();
    },
    restore() {
      Object.assign(globalThis, { IntersectionObserver: original });
    },
  };
}
