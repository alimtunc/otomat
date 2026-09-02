import type { ReactNode } from "react";

export interface PageBarProps {
  leading: ReactNode;
  tabs?: ReactNode;
  trailing?: ReactNode;
}

export function PageBar({ leading, tabs, trailing }: PageBarProps) {
  // A second flexible track would center the tab group instead of anchoring it right.
  return (
    <header className="grid h-12 flex-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-border-subtle px-4.5">
      <div className="flex min-w-0 items-center gap-2.5">{leading}</div>
      <div className="flex items-center">{tabs}</div>
      <div className="flex items-center justify-end gap-1">{trailing}</div>
    </header>
  );
}
