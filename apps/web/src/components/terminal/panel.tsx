import type { ExecutionHostDescriptor, TerminalPreview } from "@otomat/domain";
import { ErrorState, Icon, Skeleton, toast } from "@otomat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hostKeys } from "@web/api/query-keys";
import { captureTerminalClient } from "@web/api/terminal-client";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { activeHost, remoteHostAlias } from "@web/lib/active-host";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";
import { remoteShellCommand, workspaceShellCommand } from "@web/lib/workspace/open";
import { lazy, Suspense, useState } from "react";

import { TerminalCommandDialog } from "./command-dialog";
import { terminalError } from "./error";
import { TerminalToolbar } from "./toolbar";

const TerminalScreen = lazy(() =>
  import("./screen").then((module) => ({ default: module.TerminalScreen })),
);

export function TerminalPanel(
  props: { host: ExecutionHostDescriptor } & (
    | { issueId: string; runId: string | null }
    | { projectId: string }
  ),
) {
  const { host } = props;
  const issueId = "issueId" in props ? props.issueId : null;
  const projectId = "projectId" in props ? props.projectId : null;
  const emptyTitle =
    projectId !== null ? "A terminal for this project" : "A terminal for this issue";
  const emptyDescription =
    projectId !== null
      ? "Open a shell, Claude or Codex in your project checkout. Changes are made directly in this folder."
      : "Open a shell, or choose Claude or Codex to review the issue context before starting.";
  const cache = useQueryClient();
  const [sshAlias] = useState(remoteHostAlias);
  const [tool, setTool] = useState<TerminalPreview["executable"] | null>(null);
  const [client] = useState(captureTerminalClient);
  const key = ["user-terminals", host.id, activeHost().daemonUrl, issueId, projectId] as const;
  const inventory = useQuery({
    queryKey: key,
    queryFn: () => client.listTerminals(),
    retry: false,
    refetchInterval: 2000,
  });
  const session =
    inventory.data?.sessions.findLast(
      (item) => item.issue_id === issueId && (issueId !== null || item.project_id === projectId),
    ) ?? null;
  const open = useMutation({
    mutationFn: async (
      command: { tool: TerminalPreview["executable"]; contextHash: string | null } | null,
    ) => {
      const instance = inventory.data?.instance;
      if (!instance) throw new Error("This host does not offer an integrated terminal.");
      if ("projectId" in props)
        return client.openTerminal({
          instance,
          project_id: props.projectId,
          tool: command?.tool ?? null,
        });
      return client.openTerminal({
        instance,
        issue_id: props.issueId,
        run_id: props.runId,
        tool: command?.tool ?? null,
        context_hash: command?.contextHash ?? null,
      });
    },
    onSuccess: (created) => {
      cache.setQueryData(key, {
        ...inventory.data,
        sessions: [
          ...(inventory.data?.sessions ?? []).filter((item) => item.path !== created.path),
          created,
        ],
      });
      setTool(null);
      void cache.invalidateQueries({ queryKey: hostKeys(host.id).workspaces });
    },
  });
  const close = useMutation({
    mutationFn: async () => {
      if (session && inventory.data?.instance)
        await client.closeTerminal(session.id, inventory.data.instance);
    },
    onSuccess: () => {
      void inventory.refetch();
    },
  });
  const external = useMutation({
    mutationFn: async () => {
      if ("projectId" in props) {
        const project = (await client.listProjects()).find((item) => item.id === props.projectId);
        if (!project) throw new Error("The host cannot find this project.");
        if (host.id === "remote" && (!sshAlias || sshAlias !== remoteHostAlias()))
          throw new Error("Reconnect the SSH host first.");
        await navigator.clipboard.writeText(
          host.id === "remote" && sshAlias
            ? remoteShellCommand(sshAlias, project.root_path)
            : workspaceShellCommand(project.root_path),
        );
        toast.success("Command copied. Paste it in your terminal.");
        return;
      }
      const { workspace_id } = await client.prepareIssueWorkspace(props.issueId);
      const listing = await client.listWorkspaces();
      const entry = listing.entries.find((item) => item.id === workspace_id);
      if (!entry?.present) throw new Error("The host cannot find the canonical worktree.");
      if (host.id === "remote") {
        const alias = sshAlias;
        if (!alias || alias !== remoteHostAlias()) throw new Error("Reconnect the SSH host first.");
        await navigator.clipboard.writeText(remoteShellCommand(alias, entry.path));
        toast.success("SSH command copied. Paste it in your terminal.");
      } else {
        const result = await requireDesktopBridge(desktopBridge()).executionHost.openWorkspace(
          host.id,
          entry.path,
          "terminal",
        );
        if (!result.ok)
          throw new Error(
            "message" in result ? result.message : "The external terminal could not open.",
          );
      }
      void cache.invalidateQueries({ queryKey: hostKeys(host.id).workspaces });
    },
  });
  const error = open.error ?? close.error ?? external.error;
  const busy = open.isPending || close.isPending || external.isPending;
  return (
    <section
      className="flex h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle"
      aria-label="User terminal"
    >
      <QueryBoundary
        query={inventory}
        pending={<Skeleton className="m-3 h-8" />}
        error={
          <ErrorState
            title="Host unavailable"
            description="Reconnect to the host, then retry."
            onRetry={() => void inventory.refetch()}
          />
        }
      >
        {(data) => (
          <>
            <TerminalToolbar
              host={host}
              project={projectId !== null}
              session={session}
              available={data.instance !== null}
              busy={busy}
              stale={inventory.isError}
              closeError={close.error ? terminalError(close.error) : null}
              onOpen={() => open.mutate(null)}
              onInspect={(selected) => {
                open.reset();
                setTool(selected);
              }}
              onExternal={() => external.mutate()}
              onClose={(onSuccess) => close.mutate(undefined, { onSuccess })}
            />
            {session && data.instance ? (
              <Suspense fallback={<Skeleton className="m-3 flex-1" />}>
                <TerminalScreen
                  key={`${data.instance}:${session.id}`}
                  client={client}
                  instance={data.instance}
                  session={session}
                />
              </Suspense>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-1">
                  <Icon name="terminal" className="size-5 text-text-secondary" aria-hidden />
                </div>
                <h2 className="text-base font-medium">
                  {data.instance === null ? "Use your external terminal" : emptyTitle}
                </h2>
                <p className="max-w-80 text-sm leading-relaxed text-text-secondary">
                  {data.instance === null
                    ? "Integrated terminal unavailable on this host. Open an external terminal to keep working."
                    : emptyDescription}
                </p>
                <p className="max-w-80 text-xs text-text-tertiary">
                  Your session stays open when you switch tabs.
                </p>
              </div>
            )}
          </>
        )}
      </QueryBoundary>
      {error && !tool ? (
        <p
          role="alert"
          className="shrink-0 border-t border-border-subtle px-3 py-2 text-sm text-danger"
        >
          {terminalError(error)}
        </p>
      ) : null}
      {tool ? (
        <TerminalCommandDialog
          key={tool}
          client={client}
          issueId={issueId}
          tool={tool}
          busy={open.isPending}
          error={open.error ? terminalError(open.error) : null}
          onCancel={() => setTool(null)}
          onStart={(contextHash) => open.mutate({ tool, contextHash })}
        />
      ) : null}
    </section>
  );
}
