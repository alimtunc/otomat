import { useElementScrollRestoration, useRouter } from "@tanstack/react-router";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { focusRange } from "@web/components/virtual-list/focus-range";
import { keyboardTarget, virtualIndexOf } from "@web/components/virtual-list/keyboard";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";

const measurements = new Map<string, VirtualItem[]>();

export interface VirtualListOptions {
  id: string;
  count: number;
  getItemKey: (index: number) => string;
  estimateSize: (index: number) => number;
  horizontal?: boolean;
  paddingStart?: number;
}

export function useVirtualList({
  id,
  count,
  getItemKey,
  estimateSize,
  horizontal = false,
  paddingStart = 0,
}: VirtualListOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const scrollId = encodeURIComponent(id);
  const restored = useElementScrollRestoration({
    id: scrollId,
    getKey: router.options.getScrollRestorationKey,
  });
  const [focused, setFocused] = useState<number | null>(null);
  const virtualizer = useVirtualizer({
    count,
    useFlushSync: false,
    getItemKey,
    estimateSize,
    getScrollElement: () => ref.current,
    horizontal,
    paddingStart,
    overscan: 4,
    initialRect: { width: 1200, height: 600 },
    initialOffset: horizontal ? restored?.scrollX : restored?.scrollY,
    initialMeasurementsCache: measurements.get(id),
    rangeExtractor: (range) => focusRange(range, focused),
  });

  // otomat-allow-effect: scroll restoration needs the measured geometry after a virtual list unmounts.
  useEffect(
    () => () => {
      measurements.delete(id);
      measurements.set(id, virtualizer.takeSnapshot());
      if (measurements.size > 100) measurements.delete(measurements.keys().next().value ?? "");
    },
    [id, virtualizer],
  );

  const onFocusCapture = (event: FocusEvent<HTMLDivElement>): void => {
    setFocused(virtualIndexOf(event.target, ref.current, count));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest("[data-virtual-list]") !== ref.current) return;
    const index = virtualIndexOf(event.target, ref.current, count);
    if (index === null) return;
    const target = keyboardTarget(event.key, index, count, horizontal);
    if (target === null) return;
    event.preventDefault();
    flushSync(() => setFocused(target));
    virtualizer.scrollToIndex(target, { align: "auto" });
    ref.current
      ?.querySelector<HTMLElement>(
        `[data-virtual-index="${target}"] a[href], [data-virtual-index="${target}"] button:not([disabled])`,
      )
      ?.focus({ preventScroll: true });
  };

  return {
    virtualizer,
    containerProps: {
      ref,
      onFocusCapture,
      onKeyDown,
      "data-virtual-list": "",
      "data-scroll-restoration-id": scrollId,
    },
  };
}
