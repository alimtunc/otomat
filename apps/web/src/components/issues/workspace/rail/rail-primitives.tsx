import type { ReactNode } from "react";

export function RailSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-2.5 rounded-lg border border-border-subtle bg-surface-1 px-3.25 py-3 last:mb-0">
      <div className="mb-2.5 flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.03em] text-text-tertiary">
        {title}
      </div>
      {children}
    </section>
  );
}

export function RailMeta({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 text-sm">
      {children}
    </dl>
  );
}

export function RailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center justify-end gap-1.5 justify-self-end text-foreground">
        {children}
      </dd>
    </>
  );
}

/** Honest placeholder for a value the daemon/runtime did not provide. */
export function Unknown() {
  return <span className="text-text-tertiary">—</span>;
}
