import type { DaemonClient } from "@otomat/client";
import type { TerminalPreview } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  ProviderMark,
  Skeleton,
  Switch,
} from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { skipToken, useQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { activeHost } from "@web/lib/active-host";

import { terminalError } from "./error";

export function TerminalCommandDialog({
  client,
  issueId,
  tool,
  busy,
  error,
  onCancel,
  onStart,
}: {
  client: DaemonClient;
  issueId: string | null;
  tool: TerminalPreview["executable"];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onStart: (contextHash: string | null) => void;
}) {
  const form = useForm({
    defaultValues: { includeContext: issueId !== null },
    onSubmit: ({ value }) => {
      if (busy) return;
      if (!value.includeContext) onStart(null);
      else if (preview.data && !preview.isFetching && !preview.isError)
        onStart(preview.data.context_hash);
    },
  });
  const includeContext = useStore(form.store, (state) => state.values.includeContext);
  const preview = useQuery({
    queryKey: ["terminal-context", activeHost().id, activeHost().daemonUrl, issueId, tool],
    queryFn: issueId === null ? skipToken : () => client.terminalPreview(issueId, tool),
    enabled: includeContext,
    retry: false,
  });
  const label = tool === "claude" ? "Claude" : "Codex";
  const ready =
    !includeContext || (preview.data !== undefined && !preview.isFetching && !preview.isError);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader className="shrink-0 flex-col items-start gap-1.5 pr-10">
            <DialogTitle className="flex items-center gap-2">
              <ProviderMark name={tool === "claude" ? "claude" : "openai"} />
              Start {label}
            </DialogTitle>
            <DialogDescription>
              {issueId === null
                ? `Start ${label} in your project checkout.`
                : `Choose what to send to ${label} in this worktree.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="min-h-0 space-y-3 overflow-auto">
            {issueId !== null ? (
              <form.Field name="includeContext">
                {(field) => (
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle px-3 py-2.5">
                    <span className="text-sm font-medium">Include issue context</span>
                    <Switch
                      aria-label="Include issue context"
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      onBlur={field.handleBlur}
                      disabled={busy}
                    />
                  </div>
                )}
              </form.Field>
            ) : null}
            {includeContext ? (
              <div className="max-h-[40svh] overflow-auto rounded-md border border-border-subtle bg-surface-1 p-3">
                <p className="mb-2 text-xs font-medium text-text-secondary">Issue context</p>
                <QueryBoundary
                  query={preview}
                  pending={<Skeleton height={64} />}
                  error={
                    <ErrorState
                      variant="inline"
                      title="Could not load issue context"
                      description={terminalError(preview.error)}
                      onRetry={() => void preview.refetch()}
                    />
                  }
                >
                  {(data) => (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                      {data.argv.at(-1)}
                    </pre>
                  )}
                </QueryBoundary>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                {issueId === null
                  ? "No issue context is sent. The CLI can read this project’s files and local instructions."
                  : `Start ${label} without sending the issue title or description. The worktree stays the same.`}
              </p>
            )}
            {ready ? (
              <details className="text-xs text-text-secondary">
                <summary className="cursor-pointer py-1">Executable & arguments</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-3">
                  {JSON.stringify(
                    { executable: tool, arguments: includeContext ? preview.data?.argv : [] },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter className="shrink-0 justify-end">
            <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.canSubmit}>
              {(canSubmit) => (
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy || !ready || !canSubmit}
                >
                  Start {label}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
