import { cn } from "@otomat/ui";
import type { ReactNode } from "react";

export function PaneHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-[2] flex h-8.5 flex-none items-center gap-2 border-b border-border-subtle bg-background px-3.5 text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary",
        className,
      )}
    >
      {children}
    </div>
  );
}
