import type { RunEventHistory } from "@web/api/runs/use-event-history";
import { useEffect, useState, type RefCallback } from "react";

/** A failed page disarms the scroll trigger, so a broken read is retried explicitly, not on every scroll frame. */
export function useLoadOlder(history: RunEventHistory): RefCallback<HTMLDivElement> {
  const [head, setHead] = useState<HTMLDivElement | null>(null);
  const { hasOlder, loadingOlder, olderFailed, loadOlder } = history;
  const armed = hasOlder && !loadingOlder && !olderFailed;

  // otomat-allow-effect: an IntersectionObserver subscription has no declarative equivalent.
  useEffect(() => {
    if (!armed || head === null) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadOlder();
    });
    observer.observe(head);
    return () => observer.disconnect();
  }, [armed, head, loadOlder]);

  return setHead;
}
