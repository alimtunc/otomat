import type { IssueSource } from "@otomat/domain/types";
import type { HTMLAttributes } from "react";

import { SOURCE_BADGE } from "../lib/status";
import { cn } from "../lib/utils";

export interface SourceBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  source: IssueSource;
  showLabel?: boolean;
}

export function SourceBadge({
  source,
  showLabel = true,
  className,
  role = "status",
  ...rest
}: SourceBadgeProps) {
  const { var: hue, label } = SOURCE_BADGE[source];

  return (
    <span
      role={role}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={cn(
        "inline-flex h-4.5 items-center gap-1.25 whitespace-nowrap rounded-sm border border-border bg-transparent px-1.5 text-micro font-medium text-text-secondary",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="size-1.5 flex-none rounded-full border"
        style={{ backgroundColor: hue, borderColor: hue }}
      />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
