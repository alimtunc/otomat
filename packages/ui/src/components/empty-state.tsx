import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export type EmptyStateTone = "neutral" | "error";
export type EmptyStateVariant = "full" | "inline" | "compact";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: EmptyStateTone;
  variant?: EmptyStateVariant;
  className?: string;
}

const PADDING: Record<EmptyStateVariant, string> = {
  full: "48px 24px",
  inline: "28px 20px",
  compact: "16px 14px",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  variant = "full",
  className,
}: EmptyStateProps) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      data-tone={tone}
      data-variant={variant}
      className={cn(
        "estate flex flex-col items-center justify-center gap-2.5 text-center text-text-tertiary",
        className,
      )}
      style={{ padding: PADDING[variant] }}
    >
      <div
        className="grid place-items-center"
        style={{
          width: 38,
          height: 38,
          color: isError ? "var(--danger)" : "var(--text-tertiary)",
        }}
      >
        <Icon size={variant === "compact" ? 24 : 32} aria-hidden="true" />
      </div>
      <div
        className="font-semibold text-base"
        style={{ color: isError ? "var(--danger)" : "var(--text-secondary)" }}
      >
        {title}
      </div>
      {description ? (
        <div className="text-sm" style={{ maxWidth: 320 }}>
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
