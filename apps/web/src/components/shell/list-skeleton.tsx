import { Skeleton } from "@otomat/ui";

export function ListSkeleton({ rows, height }: { rows: number; height: number }) {
  return (
    <div className="flex flex-col gap-2 p-6">
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} height={height} />
      ))}
    </div>
  );
}
