import { FOCUS_RING } from "@otomat/ui";
import type { ReactNode } from "react";

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1">
      <h2 className="border-b border-border-subtle px-4 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        {title}
      </h2>
      {/* A scrollable region is only keyboard-reachable when focusable, and only announced when named. */}
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className={`max-h-96 overflow-auto p-4 ${FOCUS_RING} focus-visible:[outline-offset:-2px]`}
      >
        {children}
      </div>
    </section>
  );
}
