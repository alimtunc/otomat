type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

export interface ResizeObserverStub {
  resize: () => void;
  restore: () => void;
}

/** happy-dom has no layout, so its ResizeObserver never fires; this one fires on demand. */
export function stubResizeObserver(): ResizeObserverStub {
  const callbacks = new Set<ResizeCallback>();
  const original = globalThis.ResizeObserver;

  class Stub {
    private readonly callback: ResizeCallback;

    constructor(callback: ResizeCallback) {
      this.callback = callback;
      callbacks.add(callback);
    }

    observe(): void {}

    disconnect(): void {
      callbacks.delete(this.callback);
    }
  }

  Object.assign(globalThis, { ResizeObserver: Stub });

  return {
    resize() {
      // A callback may observe or disconnect while this loop runs.
      const live = [...callbacks];
      for (const callback of live) callback([]);
    },
    restore() {
      Object.assign(globalThis, { ResizeObserver: original });
    },
  };
}
