import type { TerminalSession } from "@otomat/domain";
import { CopyButton, Icon, Skeleton } from "@otomat/ui";
import { captureTerminalClient } from "@web/api/terminals/client";
import { useTerminalInventory } from "@web/api/terminals/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { PaneHeader } from "@web/components/runs/pane-header";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { terminalToolLabel } from "@web/lib/terminal-tool";
import { lazy, Suspense, useState } from "react";

const TerminalScreen = lazy(() =>
  import("@web/components/terminal/screen").then((module) => ({ default: module.TerminalScreen })),
);

export function TerminalReader({ session }: { session: TerminalSession }) {
  const [client] = useState(captureTerminalClient);
  const inventory = useTerminalInventory(client);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaneHeader>
        <Icon name="terminal" role="img" aria-label="Terminal" />
        <span className="truncate">
          {terminalToolLabel(session.tool)} · {session.branch}
        </span>
        <CopyButton value={session.path} label="Copy terminal path" />
      </PaneHeader>
      <p className="px-3 py-2 text-xs text-text-tertiary">
        Recent terminal output is saved locally. Ended sessions open read-only.
      </p>
      <QueryBoundary
        query={inventory}
        pending={<Skeleton className="m-4 h-24" />}
        error={
          <ErrorReport
            error={inventory.error}
            context="Couldn’t read this terminal"
            onRetry={() => void inventory.refetch()}
          />
        }
      >
        {({ instance }) =>
          instance === null ? (
            <p className="px-3 py-2 text-sm text-text-secondary">
              Connect to the desktop host to read this terminal.
            </p>
          ) : (
            <Suspense fallback={<Skeleton className="m-4 h-24" />}>
              <TerminalScreen client={client} instance={instance} session={session} />
            </Suspense>
          )
        }
      </QueryBoundary>
    </div>
  );
}
