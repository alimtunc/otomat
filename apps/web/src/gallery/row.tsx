import { cn } from "@otomat/ui";
import type { ReactNode } from "react";

export interface RowProps {
  children: ReactNode;
  align?: "center" | "start";
  className?: string;
}

export function Row({ children, align = "center", className }: RowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-3",
        align === "start" ? "items-start" : "items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
