import { useCallback, useSyncExternalStore } from "react";

/** Tailwind `lg`: below this the shell falls back to the icon rail and panes stack into strips. */
export const WIDE_VIEWPORT_MEDIA_QUERY = "(min-width: 64rem)";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
