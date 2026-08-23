import type { RunEventHistory } from "@web/api/runs/use-event-window-history";
import { useEffect, useState, type RefCallback } from "react";

/** Only a reader who scrolled up arms the trigger (a tall viewport keeps it in view), and a failed page disarms it. */
export function useLoadOlder(
  history: RunEventHistory,
  readerScrolledUp: boolean,
): RefCallback<HTMLElement> {
  const [head, setHead] = useState<HTMLElement | null>(null);
  const { hasOlder, loadingOlder, olderFailed, loadOlder } = history;
  const armed = readerScrolledUp && hasOlder && !loadingOlder && !olderFailed;

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
