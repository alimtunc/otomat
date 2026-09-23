import { Skeleton, SkeletonGroup } from "@otomat/ui";
import { LinesSkeleton } from "@web/components/shell/lines-skeleton";

export function SplitSkeleton({ side, trailing }: { side: number; trailing?: number }) {
  return (
    <SkeletonGroup className="flex h-full min-h-0">
      <div
        className="flex shrink-0 flex-col gap-2 border-r border-border-subtle p-3"
        style={{ width: side }}
      >
        {Array.from({ length: 6 }, (_, row) => (
          <Skeleton key={row} className="h-3" style={{ width: `${86 - row * 7}%` }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 items-center gap-3 border-b border-border-subtle px-4">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
        <LinesSkeleton lines={8} />
      </div>
      {trailing === undefined ? null : (
        <div className="shrink-0 border-l border-border-subtle" style={{ width: trailing }}>
          <LinesSkeleton lines={4} className="p-3.5" />
        </div>
      )}
    </SkeletonGroup>
  );
}
