import type { ReactNode } from "react";

export function AppearanceRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border-subtle py-4 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-text-tertiary">{description}</span>
      </div>
      <div className="flex-none">{control}</div>
    </div>
  );
}
