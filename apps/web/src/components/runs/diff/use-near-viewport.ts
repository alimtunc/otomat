import { useEffect, useState } from "react";

/** One screen of slack, so a card is coloured just before the reader scrolls onto it. */
const ROOT_MARGIN = "100% 0px";

/**
 * A clipping ancestor is not widened by `rootMargin`, so the slack only applies when the
 * observer's root is the element that actually scrolls the cards.
 */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll") return parent;
  }
  return null;
}

export interface NearViewport {
  ref: (node: HTMLElement | null) => void;
  near: boolean;
}

/**
 * Whether an element has come within a screen of the viewport, latched once it has.
 * Syntax highlighting costs one synchronous pass per file, so cards that have never
 * been near the viewport must not make a large diff pay for it up front.
 */
export function useNearViewport(): NearViewport {
  const [node, setNode] = useState<HTMLElement | null>(null);
  // Without the API there is nothing to wait for; colour everything rather than nothing.
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");

  // otomat-allow-effect: an IntersectionObserver subscription has no declarative equivalent.
  useEffect(() => {
    if (near || node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: scrollParent(node), rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, node]);

  return { ref: setNode, near };
}
