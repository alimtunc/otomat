import { resolveStatus, type KindStatusMap, type StatusKind } from "../lib/status";
import { cn } from "../lib/utils";
import { Chip, type ChipSize } from "./chip";

export interface StatusChipProps<K extends StatusKind = StatusKind> {
  kind: K;
  status: KindStatusMap[K];
  size?: ChipSize;
  showLabel?: boolean;
  className?: string;
}

export function StatusChip<K extends StatusKind>({
  kind,
  status,
  size = "sm",
  showLabel = true,
  className,
}: StatusChipProps<K>) {
  const { tone, icon: Icon, label, live } = resolveStatus(kind, status);

  return (
    <Chip
      tone={tone}
      size={size}
      className={cn("lowercase", !showLabel && "px-1.25", className)}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
    >
      <Icon
        aria-hidden
        className={cn(live && "animate-spin [animation-duration:2s] motion-reduce:animate-none")}
      />
      {showLabel ? <span>{label}</span> : null}
    </Chip>
  );
}
