import { useEffect, useEffectEvent } from "react";

export function useFileShortcut(open: () => void): void {
  const show = useEffectEvent(open);
  // otomat-allow-effect: capture the application shortcut before Monaco or the browser handles it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (
        event.key.toLowerCase() !== "p" ||
        event.shiftKey ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) show();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
}
