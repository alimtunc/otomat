type ObserverCallback = (entries: { isIntersecting: boolean; target: Element }[]) => void;

interface Subscription {
  callback: ObserverCallback;
  targets: Set<Element>;
}

export interface IntersectionStub {
  /** Reports every currently observed element as intersecting. */
  reveal: () => void;
  restore: () => void;
}

/** happy-dom ships an IntersectionObserver that never fires; this one does, on demand. */
export function stubIntersectionObserver(): IntersectionStub {
  const subscriptions: Subscription[] = [];
  const original = globalThis.IntersectionObserver;

  class Stub {
    private readonly subscription: Subscription;

    constructor(callback: ObserverCallback) {
      this.subscription = { callback, targets: new Set() };
      subscriptions.push(this.subscription);
    }

    observe(target: Element): void {
      this.subscription.targets.add(target);
    }

    unobserve(target: Element): void {
      this.subscription.targets.delete(target);
    }

    disconnect(): void {
      this.subscription.targets.clear();
    }

    takeRecords(): [] {
      return [];
    }
  }

  Object.assign(globalThis, { IntersectionObserver: Stub });

  return {
    reveal() {
      for (const { callback, targets } of subscriptions) {
        callback([...targets].map((target) => ({ isIntersecting: true, target })));
      }
    },
    restore() {
      Object.assign(globalThis, { IntersectionObserver: original });
    },
  };
}
