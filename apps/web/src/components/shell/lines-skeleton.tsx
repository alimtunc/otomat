import { cn, Skeleton, SkeletonGroup } from "@otomat/ui";

const LINE_WIDTHS = ["72%", "88%", "54%", "80%", "64%", "92%", "46%", "76%"];

export function LinesSkeleton({ lines, className }: { lines: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("flex flex-col gap-2.5 p-6", className)}>
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton
          key={line}
          className="h-3"
          style={{ width: LINE_WIDTHS[line % LINE_WIDTHS.length] }}
        />
      ))}
    </SkeletonGroup>
  );
}
