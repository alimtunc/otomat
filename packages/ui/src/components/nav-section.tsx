import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface NavSectionProps {
  label: string;
  collapsed?: boolean;
  className?: string;
  children: ReactNode;
}

export function NavSection({ label, collapsed = false, className, children }: NavSectionProps) {
  return (
    <div className={className}>
      {collapsed ? (
        <hr aria-label={label} className="mx-2 my-1.5 h-px border-0 bg-border-subtle" />
      ) : (
        <div className="px-2.5 pb-1 pt-3.5 text-micro font-semibold tracking-[0.03em] text-text-tertiary">
          {label}
        </div>
      )}
      <nav className={cn("flex flex-col gap-px px-2")} aria-label={label}>
        {children}
      </nav>
    </div>
  );
}
