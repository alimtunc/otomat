import type { ReactNode } from "react";

export function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="text-xs font-semibold text-text-secondary">{title}</h3>
      {children}
    </section>
  );
}
