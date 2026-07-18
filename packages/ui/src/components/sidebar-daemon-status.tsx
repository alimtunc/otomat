import { cn } from "../lib/utils";

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
  const label = [daemonId ? `daemon ${daemonId}` : version && "daemon", version]
    .filter(Boolean)
    .join(" · ");
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
