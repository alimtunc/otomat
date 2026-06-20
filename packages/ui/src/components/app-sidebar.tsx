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

export interface SidebarDaemonStatusProps {
  daemonId?: string;
  version?: string;
  online?: boolean;
  collapsed?: boolean;
}

export function SidebarDaemonStatus({
  daemonId,
  version,
  online = true,
  collapsed = false,
}: SidebarDaemonStatusProps) {
  const label = [daemonId && `daemon ${daemonId}`, version].filter(Boolean).join(" · ");
  return (
    <output
      className={cn(
        "flex h-7.5 items-center gap-2 px-2 text-xs text-text-tertiary",
        collapsed && "justify-center px-0",
      )}
    >
      <span
        aria-hidden
        className="inline-block h-1.75 w-1.75 flex-none rounded-full"
        style={{ background: online ? "var(--success)" : "var(--neutral)" }}
      />
      {!collapsed ? (
        <span className="truncate">{label || (online ? "daemon online" : "daemon offline")}</span>
      ) : null}
    </output>
  );
}
