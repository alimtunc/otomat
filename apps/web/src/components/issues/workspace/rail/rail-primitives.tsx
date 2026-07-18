import type { ReactNode } from "react";

export function RailSection({
  title,
  last = false,
  children,
}: {
  title: ReactNode;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={last ? "pb-3.5 pt-1.5" : "mb-3.5 border-b border-border-subtle pb-3.5 pt-1.5"}>
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        {title}
      </div>
      {children}
    </div>
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
      <dd className="m-0 inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden justify-self-end text-foreground">
        {children}
      </dd>
    </>
  );
}

/** Honest placeholder for a value the daemon/runtime did not provide. */
export function Unknown() {
  return <span className="text-text-tertiary">—</span>;
}
