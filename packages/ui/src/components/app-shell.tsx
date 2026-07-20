import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";

import { isEditableTarget } from "../lib/keyboard";
import type { Density } from "../lib/theme";
import { useMediaQuery, WIDE_VIEWPORT_MEDIA_QUERY } from "../lib/use-media-query";
import { cn } from "../lib/utils";
import type { ConnectionState } from "./connection-status-indicator";
import { OfflineBanner } from "./offline-banner";
import { ReconnectingBar } from "./reconnecting-bar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable-panels";

const SidebarCollapsedContext = createContext(false);

export function useSidebarCollapsed(): boolean {
  return useContext(SidebarCollapsedContext);
}

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  connectionState?: ConnectionState;
  density?: Density;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  toggleKey?: string | null;
  sidebarWidth?: number;
  railWidth?: number;
  rightPanelAutoSaveId?: string;
  className?: string;
}

export function AppShell({
  sidebar,
  topbar,
  children,
  rightPanel,
  connectionState = "online",
  density = "compact",
  collapsed: collapsedProp,
  onCollapsedChange,
  toggleKey = "[",
  sidebarWidth = 236,
  railWidth = 56,
  rightPanelAutoSaveId,
  className,
}: AppShellProps) {
  const controlled = collapsedProp != null;
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  // null = no explicit choice yet: follow the viewport (rail by default on narrow windows).
  const [internalCollapsed, setInternalCollapsed] = useState<boolean | null>(null);
  const collapsed = controlled ? collapsedProp : (internalCollapsed ?? !wide);

  const toggle = useCallback(() => {
    const next = !collapsed;
    if (!controlled) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsed, controlled, onCollapsedChange]);

  const onToggle = useEffectEvent(toggle);

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
    <main className="flex min-h-0 min-w-0 flex-col bg-background">
      {topbar}
      {connectionState === "reconnecting" ? <ReconnectingBar /> : null}
      {connectionState === "offline" ? <OfflineBanner /> : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanel ? (
          <ResizablePanelGroup autoSaveId={rightPanelAutoSaveId} className="h-full">
            <ResizablePanel id="main" minSize="30%" className="overflow-auto">
              {children}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              id="right"
              defaultSize="26%"
              minSize="16%"
              maxSize="42%"
              collapsible
              className="overflow-auto border-l border-border-subtle"
            >
              {rightPanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full overflow-auto">{children}</div>
        )}
      </div>
    </main>
  );

  return (
    <SidebarCollapsedContext.Provider value={collapsed}>
      <div
        data-density={density}
        className={cn("grid h-screen overflow-hidden", className)}
        style={{
          gridTemplateColumns: `${collapsed ? railWidth : sidebarWidth}px 1fr`,
          gridTemplateRows: "minmax(0, 1fr)",
        }}
      >
        {sidebar}
        {content}
      </div>
    </SidebarCollapsedContext.Provider>
  );
}
