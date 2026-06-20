import type { ReactNode } from "react";

export interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="border-b border-border-subtle py-7">
      <h3 className="m-0 mb-4 text-micro font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        {title}
      </h3>
      {children}
    </section>
  );
}

export interface RowProps {
  children: ReactNode;
  align?: "center" | "start";
  className?: string;
}

export function Row({ children, align = "center", className }: RowProps) {
  return (
    <div
      className={[
        "flex flex-wrap gap-3",
        align === "start" ? "items-start" : "items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
