import { useCallback, type RefCallback } from "react";

export function useNotificationAnchor(id: string): RefCallback<HTMLLIElement> {
  return useCallback(
    (node) => {
      if (node === null || window.location.hash !== `#${id}`) return;
      // The thread's initial layout and ResizeObserver must finish pinning before the anchor takes over.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() =>
          node.scrollIntoView({ block: "center", behavior: "instant" }),
        );
      });
      return () => cancelAnimationFrame(frame);
    },
    [id],
  );
}
