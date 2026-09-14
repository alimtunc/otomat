import type { ReactNode } from "react";

export interface PageBarProps {
  leading: ReactNode;
  tabs?: ReactNode;
  trailing?: ReactNode;
}

export function PageBar({ leading, tabs, trailing }: PageBarProps) {
  return (
    <header className="flex min-h-12 flex-none flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-border-subtle px-4.5 py-1.5">
      <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-2.5">{leading}</div>
      {tabs ? <div className="flex min-w-0 max-w-full overflow-x-auto">{tabs}</div> : null}
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
        {trailing}
      </div>
    </header>
  );
}
