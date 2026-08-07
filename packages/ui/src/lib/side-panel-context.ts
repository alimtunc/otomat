import { createContext, useContext } from "react";

export interface SidePanelState {
  /** Element id of the panel these controls drive; matches the panel's `id` prop. */
  panelId: string;
  label: string;
  side: "left" | "right";
  collapsed: boolean;
  toggle: () => void;
}

export const SidePanelContext = createContext<SidePanelState | null>(null);

/** `null` outside a `SidePanel`, so chrome shared with fixed layouts renders no collapse control. */
export function useSidePanel(): SidePanelState | null {
  return useContext(SidePanelContext);
}
