import type { LinearConnectionContract } from "@otomat/domain";
import { Button, ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useDisconnectLinear } from "@web/api/linear/mutations";
import { LinearConnectForm } from "@web/components/settings/integrations/linear-connect-form";
import { QueryBoundary } from "@web/components/shell/query-boundary";

type ConnectedLinear = Extract<LinearConnectionContract, { status: "connected" }>;

/** Own component so `useDisconnectLinear` runs only while a workspace is connected — a hook cannot live in the boundary callback. */
function ConnectedSummary({ connection }: { connection: ConnectedLinear }) {
  const disconnect = useDisconnectLinear();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{connection.workspace_name}</p>
        <p className="truncate text-xs text-text-tertiary">Connected as {connection.user_name}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={disconnect.isPending}
        onClick={() => disconnect.mutate()}
      >
        Disconnect
      </Button>
    </div>
  );
}

/** Renders the connection card: the connected workspace with a disconnect control, or the connect form carrying any failure. */
export function LinearConnectionPanel({
  query,
}: {
  query: UseQueryResult<LinearConnectionContract>;
}) {
  return (
    <QueryBoundary
      query={query}
      pending={<Skeleton className="h-14" />}
      error={<ErrorState variant="inline" title="Could not read the Linear connection." />}
    >
      {(connection) =>
        connection.status === "connected" ? (
          <ConnectedSummary connection={connection} />
        ) : (
          <LinearConnectForm connectionError={connection.error_message} />
        )
      }
    </QueryBoundary>
  );
}
