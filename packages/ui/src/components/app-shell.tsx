import { useCallback, useEffect, useEffectEvent, useState, type ReactNode } from "react";

import type { ConnectionState } from "../lib/connection-state";
import { isEditableTarget } from "../lib/keyboard";
import { readPanelCollapsed, writePanelCollapsed } from "../lib/panel-collapsed-storage";
import { SidebarCollapsedContext } from "../lib/sidebar-collapsed";
import type { Density } from "../lib/theme";
import { useMediaQuery } from "../lib/use-media-query";
import { usePanelGroupLayout } from "../lib/use-panel-group-layout";
import { cn } from "../lib/utils";
import { WIDE_VIEWPORT_MEDIA_QUERY } from "../lib/viewport";
import { ResizablePanel, ResizablePanelGroup } from "../primitives/resizable";
import { OfflineBanner } from "./offline-banner";
import { ReconnectingBar } from "./reconnecting-bar";
import { SidePanel } from "./side-panel";

const SIDEBAR_PANEL_ID = "sidebar";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = "32%";
const SHELL_LAYOUT_ID = "otomat.shell";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  connectionState?: ConnectionState;
  /** What the shell is waiting for while reconnecting, when it knows; the generic label otherwise. */
  connectionLabel?: string;
  density?: Density;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  toggleKey?: string | null;
  sidebarWidth?: number;
  railWidth?: number;
  className?: string;
}

export function AppShell({
  sidebar,
  topbar,
  children,
  rightPanel,
  connectionState = "online",
  connectionLabel,
  density = "compact",
  collapsed: collapsedProp,
  onCollapsedChange,
  toggleKey = "[",
  sidebarWidth = 236,
  railWidth = 56,
  className,
}: AppShellProps) {
  const controlled = collapsedProp != null;
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const [internalCollapsed, setInternalCollapsed] = useState<boolean | null>(() =>
    readPanelCollapsed(SIDEBAR_PANEL_ID),
  );
  const collapsed = controlled ? collapsedProp : (internalCollapsed ?? !wide);
  const shellLayout = usePanelGroupLayout(SHELL_LAYOUT_ID);
  const rightLayout = usePanelGroupLayout(`${SHELL_LAYOUT_ID}.right`);

  const setCollapsed = useCallback(
    (next: boolean) => {
      writePanelCollapsed(SIDEBAR_PANEL_ID, next);
      if (!controlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    },
    [controlled, onCollapsedChange],
  );

  const onToggle = useEffectEvent(() => setCollapsed(!collapsed));

  // otomat-allow-effect: subscribe a global keydown listener for the sidebar toggle shortcut.
  useEffect(() => {
    if (!toggleKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== toggleKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleKey]);

  const content = (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {topbar}
      {connectionState === "reconnecting" ? (
        <ReconnectingBar {...(connectionLabel === undefined ? {} : { label: connectionLabel })} />
      ) : null}
      {connectionState === "offline" ? <OfflineBanner /> : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanel ? (
          <ResizablePanelGroup {...rightLayout} className="h-full">
            <ResizablePanel id="content" minSize="30%" className="overflow-auto">
              {children}
            </ResizablePanel>
            <SidePanel
              id="right"
              label="Details"
              side="right"
              defaultSize="26%"
              minSize="16%"
              maxSize="42%"
            >
              {rightPanel}
            </SidePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full overflow-auto">{children}</div>
        )}
      </div>
    </main>
  );

  return (
    <SidebarCollapsedContext.Provider value={collapsed}>
      <div data-density={density} className={cn("h-screen overflow-hidden", className)}>
        <ResizablePanelGroup {...shellLayout}>
          <SidePanel
            id={SIDEBAR_PANEL_ID}
            label="Sidebar"
            side="left"
            defaultSize={sidebarWidth}
            minSize={SIDEBAR_MIN_WIDTH}
            maxSize={SIDEBAR_MAX_WIDTH}
            collapsedSize={railWidth}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            rail={sidebar}
          >
            {sidebar}
          </SidePanel>
          <ResizablePanel id="main" minSize="40%">
            {content}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SidebarCollapsedContext.Provider>
  );
}
