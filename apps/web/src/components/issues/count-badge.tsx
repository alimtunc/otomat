import { cn } from "@otomat/ui";

export function CountBadge({ count, tone }: { count: number; tone: "accent" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex h-4.25 min-w-4.25 items-center justify-center rounded-full px-1.25 text-micro font-medium tabular-nums",
        tone === "accent" ? "bg-iris-solid text-white" : "bg-surface-3 text-text-secondary",
      )}
    >
      {count}
    </span>
  );
}
