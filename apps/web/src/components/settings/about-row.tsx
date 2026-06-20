import type { ReactNode } from "react";

export function AboutRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-text-tertiary">{value}</dd>
    </div>
  );
}
