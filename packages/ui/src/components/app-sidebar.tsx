import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { ScrollArea } from "../primitives/scroll-area";

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
      className={cn(
        "flex min-w-0 flex-col overflow-hidden bg-sidebar border-r border-border-subtle",
        className,
      )}
    >
      {projectSwitcher}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-px pb-2 pt-1.5">{children}</div>
      </ScrollArea>
      {footer ? <div className="border-t border-border-subtle p-2">{footer}</div> : null}
    </aside>
  );
}
