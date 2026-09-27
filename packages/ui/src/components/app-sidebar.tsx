import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { ScrollArea } from "../primitives/scroll-area";
import { SidePanelToggle } from "./side-panel-toggle";

export interface AppSidebarProps {
  projectSwitcher?: ReactNode;
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
  children: ReactNode;
}

export function AppSidebar({
  projectSwitcher,
  footer,
  collapsed = false,
  className,
  children,
}: AppSidebarProps) {
  return (
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar", className)}
    >
      <div className="flex h-12 min-w-0 shrink-0 items-center gap-3 px-4">
        <SidePanelToggle className="shrink-0" />
        <div className={collapsed ? "hidden" : "min-w-0 flex-1"}>{projectSwitcher}</div>
      </div>
      <ScrollArea className="flex-1" viewportClassName="[&>div]:min-w-0!">
        <div className="flex flex-col gap-px pb-2 pt-1.5">{children}</div>
      </ScrollArea>
      {footer ? <div className="border-t border-border-subtle p-2">{footer}</div> : null}
    </aside>
  );
}
