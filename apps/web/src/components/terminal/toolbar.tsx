import type { DaemonClient } from "@otomat/client";
import {
  terminalToolSchema,
  type ExecutionHostDescriptor,
  type TerminalSession,
  type TerminalTool,
} from "@otomat/domain";
import { Button, CopyButton, Icon, IconButton, LiveDot, ProviderMark } from "@otomat/ui";
import { runtimeMark } from "@web/lib/runtimes";
import { terminalToolLabel } from "@web/lib/terminal-tool";

import { EndSessionDialog } from "./end-session-dialog";

export function TerminalToolbar({
  client,
  host,
  project,
  session,
  instance,
  busy,
  stale,
  onOpen,
  onInspect,
  onExternal,
}: {
  client: DaemonClient;
  host: ExecutionHostDescriptor;
  project: boolean;
  session: TerminalSession | null;
  instance: string | null;
  busy: boolean;
  stale: boolean;
  onOpen: (instance: string) => void;
  onInspect: (tool: TerminalTool) => void;
  onExternal: () => void;
}) {
  const remote = host.id === "remote";
  const localFallbackLabel = project ? "Copy terminal command" : "Open in external terminal";
  const live = session !== null && session.state !== "exited";
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-surface-1 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Icon name="terminal" className="size-3.5 text-text-secondary" aria-hidden />
          <span className="font-medium">{live ? terminalToolLabel(session.tool) : "Terminal"}</span>
          <span className="text-text-tertiary">/</span>
          <span className="max-w-32 truncate text-text-secondary" title={host.label}>
            {host.label}
          </span>
          {live ? (
            <>
              <LiveDot tone="success" live size={6} />
              <span className="sr-only">Session active</span>
            </>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!live && instance !== null ? (
            <>
              <Button size="sm" disabled={busy || stale} onClick={() => onOpen(instance)}>
                <Icon name="terminal" aria-hidden />
                Open shell
              </Button>
              {terminalToolSchema.options.map((tool) => {
                const mark = runtimeMark(tool);
                return (
                  <Button
                    key={tool}
                    size="sm"
                    variant="ghost"
                    disabled={busy || stale}
                    onClick={() => onInspect(tool)}
                  >
                    {mark === null ? null : <ProviderMark name={mark} />}
                    {terminalToolLabel(tool)}
                  </Button>
                );
              })}
            </>
          ) : null}
          <IconButton
            label={remote ? "Copy SSH command" : localFallbackLabel}
            icon={<Icon name={remote || project ? "copy" : "external-link"} aria-hidden />}
            disabled={busy || stale}
            onClick={onExternal}
          />
          {live && instance !== null ? (
            <EndSessionDialog
              client={client}
              instance={instance}
              session={session}
              disabled={busy}
            />
          ) : null}
        </div>
      </div>
      {session ? (
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-1 text-xs text-text-secondary">
          <Icon name="folder-git-2" className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-mono" title={session.branch}>
            {session.branch}
          </span>
          <CopyButton
            value={session.path}
            label={project ? "Copy project path" : "Copy worktree path"}
          />
        </div>
      ) : null}
    </>
  );
}
