import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { FOCUS_RING } from "../lib/focus";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Kbd } from "./kbd";

export interface TopbarProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  connectionStatus?: ReactNode;
  onSearch?: () => void;
  searchLabel?: string;
  searchKbd?: string;
  scrolled?: boolean;
  className?: string;
}

export function Topbar({
  breadcrumbs,
  actions,
  connectionStatus,
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
        <Button
          type="button"
          variant="outline"
          onClick={onSearch}
          aria-keyshortcuts="Meta+K"
          className={cn(
            "h-7 w-57.5 min-w-30 flex-[0_1_230px] justify-start gap-2 bg-background px-2.25 font-normal text-text-tertiary",
            "hover:border-border-strong",
            FOCUS_RING,
          )}
          style={{ transition: "border-color var(--motion-fast) var(--ease)" }}
        >
          <Search className="h-3.5 w-3.5 flex-none" />
          <span className="flex-1 truncate text-left">{searchLabel}</span>
          <Kbd>{searchKbd}</Kbd>
        </Button>
      ) : null}
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      {connectionStatus ? (
        <div className="flex items-center gap-1.5 px-1.5 text-xs">{connectionStatus}</div>
      ) : null}
    </header>
  );
}
