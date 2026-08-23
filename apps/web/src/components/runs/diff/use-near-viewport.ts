import { scrollParent } from "@web/components/runs/diff/scroll";
import { useCallback, useEffect, useState } from "react";

const ROOT_MARGIN = "100% 0px";

export interface NearViewport {
  ref: (node: HTMLElement | null) => void;
  near: boolean;
}

// Latched: highlighting costs a synchronous pass per file, so a large diff must not pay up front.
export function useNearViewport(): NearViewport {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [root, setRoot] = useState<HTMLElement | null>(null);

  const attach = useCallback((next: HTMLElement | null) => {
    setNode(next);
    setRoot(next === null ? null : scrollParent(next));
  }, []);

  // Resolving `null` again schedules no render, so the retry has to ride every later one.
  // otomat-allow-effect: a card can attach before the panel scrolling it has been laid out.
  useEffect(() => {
    if (near || node === null || root !== null) return;
    setRoot(scrollParent(node));
  });

  // A clipping ancestor is not widened by `rootMargin`: the slack only applies while the root scrolls the cards.
  // otomat-allow-effect: an IntersectionObserver subscription has no declarative equivalent.
  useEffect(() => {
    if (near || node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root, rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, node, root]);

  return { ref: attach, near };
}
