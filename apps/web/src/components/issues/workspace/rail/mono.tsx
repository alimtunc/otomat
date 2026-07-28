import { cn } from "@otomat/ui";
import type { ReactNode } from "react";

export function Mono({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("truncate font-mono text-xs text-text-secondary", className)} title={title}>
      {children}
    </span>
  );
}
