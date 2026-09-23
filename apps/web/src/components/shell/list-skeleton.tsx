import { Skeleton, SkeletonGroup } from "@otomat/ui";

const TITLE_WIDTHS = ["58%", "44%", "66%", "51%", "38%", "62%", "47%"];

export function ListSkeleton({
  rows,
  height,
  header = false,
}: {
  rows: number;
  height: number;
  header?: boolean;
}) {
  return (
    <SkeletonGroup className="flex flex-col">
      {header ? (
        <div className="flex h-7.5 items-center gap-8 border-b border-border-subtle px-3">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-3 border-b border-border-subtle px-3"
          style={{ height }}
        >
          <Skeleton circle width={14} height={14} />
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-3" style={{ width: TITLE_WIDTHS[row % TITLE_WIDTHS.length] }} />
          <Skeleton className="ml-auto h-5 w-16 shrink-0" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
