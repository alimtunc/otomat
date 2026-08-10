import { useMediaQuery } from "@otomat/ui";
import { useCallback, useLayoutEffect, useRef, useState, type RefCallback } from "react";

/** Slack under the last item: a reader this close to the bottom is still reading the newest message. */
const PIN_THRESHOLD_PX = 64;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface ThreadAutoscroll {
  viewportRef: RefCallback<HTMLDivElement>;
  contentRef: RefCallback<HTMLDivElement>;
  /** Whether the thread follows its last item; false once the reader scrolled up to read. */
  pinned: boolean;
  jumpToLatest: () => void;
}

/**
 * Keeps a run's conversation on its newest item while the reader sits at the bottom.
 * Growth follows only while pinned, so nothing ever pulls back a reader who scrolled
 * up: only their own scroll, an explicit jump, or opening another run re-pins.
 */
export function useThreadAutoscroll(runId: string): ThreadAutoscroll {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  const lastDistanceRef = useRef(0);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  const pin = useCallback((next: boolean) => {
    if (pinnedRef.current === next) return;
    pinnedRef.current = next;
    setPinned(next);
  }, []);

  // otomat-allow-effect: scroll position lives in the DOM; only an observer can track it.
  useLayoutEffect(() => {
    if (viewport === null || content === null) return;

    const stick = () => {
      if (pinnedRef.current) viewport.scrollTop = viewport.scrollHeight;
    };
    const onScroll = () => {
      const distance = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      const atBottom = distance <= PIN_THRESHOLD_PX;
      const receding = distance > lastDistanceRef.current;
      lastDistanceRef.current = distance;
      if (atBottom || receding) pin(atBottom);
    };

    lastDistanceRef.current = 0;
    pin(true);
    stick();

    const observer = new ResizeObserver(stick);
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [viewport, content, runId, pin]);

  const jumpToLatest = useCallback(() => {
    if (viewport === null) return;
    const behavior = reducedMotion ? "auto" : "smooth";
    pin(true);
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, [viewport, reducedMotion, pin]);

  return { viewportRef: setViewport, contentRef: setContent, pinned, jumpToLatest };
}
