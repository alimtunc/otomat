import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface MetaListItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

export interface MetaListProps {
  items: MetaListItem[];
  className?: string;
}

export function MetaList({ items, className }: MetaListProps) {
  return (
    <dl
      className={cn("grid items-center text-sm", className)}
      style={{ gridTemplateColumns: "auto 1fr", gap: "9px 12px" }}
    >
      {items.map((item) => (
        <div key={item.key} className="contents">
          <dt className="text-xs text-text-tertiary">{item.label}</dt>
          <dd className="m-0 inline-flex items-center gap-1.5 justify-self-end">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
