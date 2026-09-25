import { CopyButton, Icon, Skeleton } from "@otomat/ui";
import { useQuery } from "@tanstack/react-query";
import { captureTerminalClient } from "@web/api/terminal-client";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { PaneHeader } from "@web/components/runs/pane-header";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { activeHost } from "@web/lib/active-host";
import { lazy, Suspense } from "react";

const TerminalScreen = lazy(() =>
  import("@web/components/terminal/screen").then((module) => ({ default: module.TerminalScreen })),
);

export function TerminalConversationBody({ terminalId }: { terminalId: string }) {
  const reading = useQuery({
    queryKey: ["terminal-history", activeHost().id, activeHost().daemonUrl, terminalId],
    queryFn: async () => {
      const client = captureTerminalClient();
      const { instance } = await client.listTerminals();
      if (instance === null) throw new Error("Connect to the desktop host to read this terminal.");
      const output = await client.terminalOutput(terminalId, instance, 0);
      return { client, instance, session: output.session };
    },
    retry: false,
  });
  return (
    <QueryBoundary
      query={reading}
      pending={<Skeleton className="m-4 h-24" />}
      error={
        <ErrorReport
          error={reading.error}
          context="Couldn’t read this terminal"
          onRetry={() => void reading.refetch()}
        />
      }
    >
      {({ client, instance, session }) => (
        <div className="flex h-full min-h-0 flex-col">
          <PaneHeader>
            <Icon name="terminal" aria-hidden />
            <span className="truncate">
              {session.tool ?? "Shell"} · {session.branch}
            </span>
            <CopyButton value={session.path} label="Copy terminal path" />
          </PaneHeader>
          <p className="px-3 py-2 text-xs text-text-tertiary">
            Recent terminal output is saved locally. Ended sessions open read-only.
          </p>
          <Suspense fallback={<Skeleton className="m-4 h-24" />}>
            <TerminalScreen client={client} instance={instance} session={session} />
          </Suspense>
        </div>
      )}
    </QueryBoundary>
  );
}
