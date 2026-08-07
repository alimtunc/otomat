import { useEffect, useState, type ReactNode } from "react";

import { readPanelCollapsed, writePanelCollapsed } from "../lib/panel-collapsed-storage";
import { SidePanelContext } from "../lib/side-panel-context";
import { ResizableHandle, ResizablePanel, usePanelRef } from "../primitives/resizable";
import { SidePanelToggle } from "./side-panel-toggle";

const RAIL_SIZE = 40;

export interface SidePanelProps {
  /**
   * Unique across the app: names the panel in its group's stored layout, in the
   * stored collapsed flag, and in `aria-controls`.
   */
  id: string;
  label: string;
  side: "left" | "right";
  defaultSize: number | string;
  minSize: number | string;
  maxSize: number | string;
  collapsedSize?: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Rendered instead of `children` while collapsed; defaults to a rail carrying
   * the expand control.
   */
  rail?: ReactNode;
  children: ReactNode;
}

/**
 * A collapsible sidebar panel plus the handle that resizes it. It renders as a fragment
 * because the library requires panels and separators to be direct children of their
 * group, so place it inside a `ResizablePanelGroup`.
 */
export function SidePanel({
  id,
  label,
  side,
  defaultSize,
  minSize,
  maxSize,
  collapsedSize = RAIL_SIZE,
  collapsed: collapsedProp,
  onCollapsedChange,
  rail,
  children,
}: SidePanelProps) {
  const panelRef = usePanelRef();
  const [storedCollapsed, setStoredCollapsed] = useState(() => readPanelCollapsed(id) ?? false);
  const collapsed = collapsedProp ?? storedCollapsed;

  function requestCollapsed(next: boolean) {
    if (next === collapsed) return;
    if (collapsedProp === undefined) {
      writePanelCollapsed(id, next);
      setStoredCollapsed(next);
    }
    onCollapsedChange?.(next);
  }

  // otomat-allow-effect: the collapsed state lives in the library's layout, so every change
  // — restored flag, keyboard shortcut, toggle — reaches it through the imperative panel API.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null || panel.isCollapsed() === collapsed) return;
    if (collapsed) panel.collapse();
    else panel.expand();
  }, [collapsed, panelRef]);

  const defaultRail = (
    <div className="flex h-full flex-col items-center gap-2 bg-sidebar py-2">
      <SidePanelToggle />
      <span
        aria-hidden
        className="truncate text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary [writing-mode:vertical-rl]"
      >
        {label}
      </span>
    </div>
  );

  const panelElement = (
    <ResizablePanel
      id={id}
      panelRef={panelRef}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsedSize={collapsedSize}
      collapsible
      onResize={(_size, _id, previous) => {
        const panel = panelRef.current;
        // `previous` is undefined on mount, where the stored collapsed flag is the authority.
        if (previous === undefined || panel === null) return;
        requestCollapsed(panel.isCollapsed());
      }}
    >
      <SidePanelContext.Provider
        value={{ panelId: id, label, side, collapsed, toggle: () => requestCollapsed(!collapsed) }}
      >
        {collapsed ? (rail ?? defaultRail) : children}
      </SidePanelContext.Provider>
    </ResizablePanel>
  );
  const handleElement = <ResizableHandle aria-label={`Resize ${label}`} />;

  return side === "left" ? (
    <>
      {panelElement}
      {handleElement}
    </>
  ) : (
    <>
      {handleElement}
      {panelElement}
    </>
  );
}
