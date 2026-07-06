import { useCallback, useEffect, useState } from "react";

export type UseCommandPaletteOptions = {
  defaultOpen?: boolean;
};

export type UseCommandPaletteReturn = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export function useCommandPalette(options: UseCommandPaletteOptions = {}): UseCommandPaletteReturn {
  const [open, setOpen] = useState(options.defaultOpen ?? false);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  // otomat-allow-effect: subscribe a global keydown listener for the ⌘K/Ctrl-K open shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { open, setOpen, toggle };
}
