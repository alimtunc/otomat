import type { ReactNode } from "react";

export function CompareRow({
  label,
  local,
  remote,
}: {
  label: string;
  local: ReactNode;
  remote: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 border-t border-border-subtle py-2 text-sm">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="min-w-0 break-words text-foreground">{local}</span>
      <span className="min-w-0 break-words text-foreground">{remote}</span>
    </div>
  );
}
