import { useElementScrollRestoration, useRouter } from "@tanstack/react-router";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { focusRange } from "@web/components/virtual-list/focus-range";
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

  const focusedIndex = (target: EventTarget): number | null => {
    if (!(target instanceof HTMLElement)) return null;
    let item = target.closest<HTMLElement>("[data-virtual-index]");
    while (item && item.parentElement?.closest("[data-virtual-list]") !== ref.current) {
      item = item.parentElement?.closest<HTMLElement>("[data-virtual-index]") ?? null;
    }
    const index = Number(item?.dataset.virtualIndex);
    return Number.isInteger(index) && index >= 0 && index < count ? index : null;
  };

  const onFocusCapture = (event: FocusEvent<HTMLDivElement>): void => {
    setFocused(focusedIndex(event.target));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest("[data-virtual-list]") !== ref.current) return;
    const index = focusedIndex(event.target);
    if (index === null) return;
    const previous = horizontal ? "ArrowLeft" : "ArrowUp";
    const next = horizontal ? "ArrowRight" : "ArrowDown";
    let target: number | null = null;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = count - 1;
    if (event.key === previous) target = index - 1;
    if (event.key === next) target = index + 1;
    if (target === null || target < 0 || target >= count) return;
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
