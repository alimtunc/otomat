import { cn } from "@otomat/ui";

export interface IssueLabelProps {
  identifier: string | null;
  title: string | null;
  className?: string;
}

export function IssueLabel({ identifier, title, className }: IssueLabelProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)} title={title ?? undefined}>
      {identifier === null ? null : (
        <span className="shrink-0 font-mono text-xs font-normal text-text-tertiary">
          {identifier}
        </span>
      )}
      <span className="truncate">{title}</span>
    </span>
  );
}
