import type { ReactNode } from "react";

export type EvidenceSectionProps = { label: string } & (
  | { empty: string; children?: never }
  | { empty?: never; children: ReactNode }
);

/** One labelled evidence block of a candidate card: either the evidence itself, or the honest reason there is none. */
export function EvidenceSection({ label, empty, children }: EvidenceSectionProps) {
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      {empty === undefined ? children : <p className="text-xs text-text-tertiary">{empty}</p>}
    </section>
  );
}
