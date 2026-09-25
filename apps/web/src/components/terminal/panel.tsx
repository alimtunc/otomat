import type { ExecutionHostDescriptor, TerminalOpenRequest, TerminalTool } from "@otomat/domain";
import { EmptyState, Skeleton } from "@otomat/ui";
import { captureTerminalClient } from "@web/api/terminals/client";
import { useOpenTerminal } from "@web/api/terminals/mutations";
import { useTerminalInventory } from "@web/api/terminals/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { lazy, Suspense, useState } from "react";

import { TerminalCommandDialog } from "./command-dialog";
import { terminalError } from "./error";
import { TerminalToolbar } from "./toolbar";
import { useExternalTerminal } from "./use-external-terminal";

const TerminalScreen = lazy(() =>
  import("./screen").then((module) => ({ default: module.TerminalScreen })),
);

export function TerminalPanel(
  props: { host: ExecutionHostDescriptor } & (
    | { issueId: string; runId: string | null }
    | { projectId: string; rootPath: string }
  ),
) {
  const { host } = props;
  const issueId = "issueId" in props ? props.issueId : null;
  const projectId = "projectId" in props ? props.projectId : null;
  const [tool, setTool] = useState<TerminalTool | null>(null);
  const [client] = useState(captureTerminalClient);
  const inventory = useTerminalInventory(client);
  const open = useOpenTerminal(client);
  const external = useExternalTerminal(client, host);
  const session =
    inventory.data?.sessions.findLast(
      (item) => item.issue_id === issueId && (issueId !== null || item.project_id === projectId),
    ) ?? null;
  const start = (
    instance: string,
    command: { tool: TerminalTool; contextHash: string | null } | null,
  ): void => {
    const request: TerminalOpenRequest =
      "projectId" in props
        ? { instance, project_id: props.projectId, tool: command?.tool ?? null }
        : {
            instance,
            issue_id: props.issueId,
            run_id: props.runId,
            tool: command?.tool ?? null,
            context_hash: command?.contextHash ?? null,
          };
    open.mutate(request, { onSuccess: () => setTool(null) });
  };
  const target = projectId === null ? "issue" : "project";
  const targetDescription =
    projectId === null
      ? "Open a shell, or choose Claude or Codex to review the issue context before starting."
      : "Open a shell, Claude or Codex in your project checkout. Changes are made directly in this folder.";
  const inspecting = tool !== null && (inventory.data?.instance ?? null) !== null;
  const error = open.error ?? external.error;
  const busy = open.isPending || external.isPending;
  return (
    <section
      className="flex h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle"
      aria-label="User terminal"
    >
      <QueryBoundary
        query={inventory}
        pending={<Skeleton className="m-3 h-8" />}
        error={
          <ErrorReport
            error={inventory.error}
            context="Couldn’t load terminals"
            onRetry={() => void inventory.refetch()}
          />
        }
      >
        {({ instance }) => (
          <>
            <TerminalToolbar
              client={client}
              host={host}
              project={projectId !== null}
              session={session}
              instance={instance}
              busy={busy}
              stale={inventory.isError}
              onOpen={(available) => start(available, null)}
              onInspect={(selected) => {
                open.reset();
                setTool(selected);
              }}
              onExternal={() =>
                external.mutate(
                  "projectId" in props ? { rootPath: props.rootPath } : { issueId: props.issueId },
                )
              }
            />
            {session && instance ? (
              <Suspense fallback={<Skeleton className="m-3 flex-1" />}>
                <TerminalScreen
                  key={`${instance}:${session.id}`}
                  client={client}
                  instance={instance}
                  session={session}
                />
              </Suspense>
            ) : (
              <EmptyState
                icon="terminal"
                className="flex-1"
                title={
                  instance === null ? "Use your external terminal" : `A terminal for this ${target}`
                }
                description={
                  instance === null
                    ? "Integrated terminal unavailable on this host. Open an external terminal to keep working."
                    : targetDescription
                }
              />
            )}
            {tool !== null && instance !== null ? (
              <TerminalCommandDialog
                key={tool}
                client={client}
                issueId={issueId}
                tool={tool}
                busy={open.isPending}
                error={open.error ? terminalError(open.error) : null}
                onCancel={() => setTool(null)}
                onStart={(contextHash) => start(instance, { tool, contextHash })}
              />
            ) : null}
          </>
        )}
      </QueryBoundary>
      {error && !inspecting ? (
        <p
          role="alert"
          className="shrink-0 border-t border-border-subtle px-3 py-2 text-sm text-danger"
        >
          {terminalError(error)}
        </p>
      ) : null}
    </section>
  );
}
