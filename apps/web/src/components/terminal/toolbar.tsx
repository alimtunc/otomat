import type { ExecutionHostDescriptor, TerminalSession } from "@otomat/domain";
import {
  Button,
  CopyButton,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  IconButton,
  ProviderMark,
} from "@otomat/ui";
import { useState } from "react";

export function TerminalToolbar({
  host,
  project = false,
  session,
  available,
  busy,
  stale,
  closeError,
  onOpen,
  onInspect,
  onExternal,
  onClose,
}: {
  host: ExecutionHostDescriptor;
  project?: boolean;
  session: TerminalSession | null;
  available: boolean;
  busy: boolean;
  stale: boolean;
  closeError: string | null;
  onOpen: () => void;
  onInspect: (tool: "claude" | "codex") => void;
  onExternal: () => void;
  onClose: (onSuccess: () => void) => void;
}) {
  const [confirmClose, setConfirmClose] = useState(false);
  const localFallbackLabel = project ? "Copy terminal command" : "Open in external terminal";
  const live = session !== null && session.state !== "exited";
  const tool = { claude: "Claude", codex: "Codex", shell: "Shell" }[session?.tool ?? "shell"];
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-surface-1 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Icon name="terminal" className="size-3.5 text-text-secondary" aria-hidden />
          <span className="font-medium">{live ? tool : "Terminal"}</span>
          <span className="text-text-tertiary">/</span>
          <span className="max-w-32 truncate text-text-secondary" title={host.label}>
            {host.label}
          </span>
          {live ? (
            <span className="size-1.5 rounded-full bg-success" aria-label="Session active" />
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!live && available ? (
            <>
              <Button size="sm" disabled={busy || stale} onClick={onOpen}>
                <Icon name="terminal" aria-hidden />
                Open shell
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || stale}
                onClick={() => onInspect("claude")}
              >
                <ProviderMark name="claude" />
                Claude
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || stale}
                onClick={() => onInspect("codex")}
              >
                <ProviderMark name="openai" />
                Codex
              </Button>
            </>
          ) : null}
          <IconButton
            label={host.id === "remote" ? "Copy SSH command" : localFallbackLabel}
            icon={<Icon name={project ? "copy" : "external-link"} aria-hidden />}
            disabled={busy || stale}
            onClick={onExternal}
          />
          {live ? (
            <IconButton
              label="End session"
              icon={<Icon name="square" aria-hidden />}
              disabled={busy || session.state === "closing"}
              onClick={() => setConfirmClose(true)}
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
      <Dialog
        open={confirmClose}
        onOpenChange={(open) => {
          if (!busy) setConfirmClose(open);
        }}
      >
        <DialogContent>
          <DialogHeader className="flex-col items-start gap-1.5 pr-10">
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              This stops the shell and its active command. Your worktree and saved files stay in
              place.
            </DialogDescription>
          </DialogHeader>
          {closeError ? (
            <DialogBody>
              <p role="alert" className="text-sm text-danger">
                {closeError}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter className="justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmClose(false)}>
              Keep working
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              disabled={busy}
              onClick={() => onClose(() => setConfirmClose(false))}
            >
              End session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
