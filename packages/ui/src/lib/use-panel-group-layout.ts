import { useDefaultLayout, type Layout, type LayoutChangedMeta } from "../primitives/resizable";

const NO_STORAGE: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => null,
  setItem: () => {},
};

export interface PanelGroupLayout {
  id: string;
  defaultLayout: Layout | undefined;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
}

/**
 * Restores and persists one panel group's sizes under `id`. A collapsed panel is stored
 * at its collapsed size, so widths and collapsed panels come back together. Spread the
 * result onto `ResizablePanelGroup`.
 */
export function usePanelGroupLayout(id: string): PanelGroupLayout {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id,
    storage: typeof window === "undefined" ? NO_STORAGE : window.localStorage,
  });
  return { id, defaultLayout, onLayoutChanged };
}
