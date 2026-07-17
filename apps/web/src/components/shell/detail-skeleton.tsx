import { Skeleton } from "@otomat/ui";

export function DetailSkeleton({
  blocks = 1,
  blockClassName = "h-40 w-full",
}: {
  blocks?: number;
  blockClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-8 w-64" />
      {Array.from({ length: blocks }, (_, block) => (
        <Skeleton key={block} className={blockClassName} />
      ))}
    </div>
  );
}
