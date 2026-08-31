import { ErrorState, Skeleton } from "@otomat/ui";
import { useLinearConnections } from "@web/api/linear/queries";
import { LinearConnectionRow } from "@web/components/settings/integrations/linear/row";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function LinearConnectionsPanel() {
  const connections = useLinearConnections();
  return (
    <QueryBoundary
      query={connections}
      pending={<Skeleton className="h-14" />}
      error={<ErrorState variant="inline" title="Could not read the Linear connections." />}
      staleData="block"
    >
      {(rows) =>
        rows.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            No Linear connection yet. Connect one below, then map its teams from a project&apos;s
            settings.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((connection) => (
              <LinearConnectionRow key={connection.id} connection={connection} />
            ))}
          </ul>
        )
      }
    </QueryBoundary>
  );
}
