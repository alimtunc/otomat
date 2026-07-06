import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { RuntimeRow } from "@web/components/settings/runtimes/row";
import { SectionHeading } from "@web/components/settings/section-heading";
import { QueryList } from "@web/components/shell/query-list";

export function RuntimesSection() {
  const runtimes = useRuntimes();
  return (
    <div>
      <SectionHeading
        title="Runtimes"
        description="Adapter catalog with honest capability snapshots, as reported by the daemon."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <QueryList
          query={runtimes}
          pending={<Skeleton className="m-4" height={40} />}
          error={
            <ErrorState
              variant="inline"
              title="Couldn’t load runtimes"
              onRetry={() => void runtimes.refetch()}
            />
          }
          empty={
            <EmptyState
              icon="terminal"
              variant="inline"
              title="No runtimes reported"
              description="Runtime adapters are reported by the daemon. Capabilities are shown as present or absent — never aspirational."
            />
          }
        >
          {(descriptors) => (
            <div className="divide-y divide-border-subtle">
              {descriptors.map((runtime) => (
                <RuntimeRow key={runtime.id} runtime={runtime} />
              ))}
            </div>
          )}
        </QueryList>
      </div>
    </div>
  );
}
