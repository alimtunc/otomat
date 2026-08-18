import { CopyButton, FOCUS_RING, cn } from "@otomat/ui";

export interface CopyablePathProps {
  value: string;
  label: string;
}

export function CopyablePath({ value, label }: CopyablePathProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        // Ellipsises the start so the meaningful tail survives; the inner `bdi` keeps the value LTR.
        dir="rtl"
        tabIndex={0}
        title={value}
        aria-label={`${label}: ${value}`}
        className={cn(
          "min-w-0 flex-1 truncate text-left font-mono text-xs text-text-secondary",
          FOCUS_RING,
          "focus-visible:rounded-sm",
        )}
      >
        <bdi>{value}</bdi>
      </span>
      <CopyButton value={value} label={`Copy ${label}`} copiedLabel={`${label} copied`} />
    </span>
  );
}
