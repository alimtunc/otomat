import { Skeleton } from "@otomat/ui";

export function AgentProfileDetailSkeleton() {
  return (
    <div className="grid min-h-full grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border-b border-border-subtle bg-sidebar p-4 lg:border-r lg:border-b-0">
        <Skeleton width={40} height={40} className="mb-2" />
        <Skeleton width="60%" height={18} className="mb-4" />
        <Skeleton width="100%" height={116} className="mb-2.5" />
        <Skeleton width="100%" height={176} />
      </div>
      <div className="p-4.5">
        <Skeleton width={180} height={34} className="mb-4.5" />
        <Skeleton width="min(720px,100%)" height={280} />
      </div>
    </div>
  );
}
