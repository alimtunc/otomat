import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Kbd } from "./kbd";

export interface TopbarProps {
  breadcrumbs?: ReactNode;
  connectionStatus?: ReactNode;
  actions?: ReactNode;
  onSearch?: () => void;
  searchLabel?: string;
  searchKbd?: string;
  scrolled?: boolean;
  className?: string;
}

export function Topbar({
  breadcrumbs,
  connectionStatus,
  actions,
  onSearch,
  searchLabel = "Search…",
  searchKbd = "⌘K",
  scrolled = false,
  className,
}: TopbarProps) {
  return (
    <header
      className={cn(
        "flex h-11 flex-none items-center gap-2.5 border-b border-border-subtle pl-3.5 pr-3",
        scrolled && "border-border",
        className,
      )}
    >
      {breadcrumbs ? <div className="flex min-w-0 items-center">{breadcrumbs}</div> : null}
      <div className="flex-1" />
      {onSearch ? (
        <button
          type="button"
          onClick={onSearch}
          aria-keyshortcuts="Meta+K"
          className={cn(
            "flex h-7 w-57.5 min-w-30 flex-[0_1_230px] items-center gap-2 rounded-md border border-border bg-background px-2.25 text-sm text-text-tertiary",
            "hover:border-border-strong",
            "focus-visible:outline-none focus-visible:[outline:2px_solid_var(--iris-ring)]",
          )}
          style={{ transition: "border-color var(--motion-fast) var(--ease)" }}
        >
          <Search className="h-3.5 w-3.5 flex-none" />
          <span className="flex-1 truncate text-left">{searchLabel}</span>
          <Kbd>{searchKbd}</Kbd>
        </button>
      ) : null}
      {connectionStatus ? (
        <div className="flex items-center gap-1.5 px-1.5 text-xs">{connectionStatus}</div>
      ) : null}
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
