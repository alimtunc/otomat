import type { RunDetail } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { RunActionButtons } from "@web/components/runs/cockpit/run-action-buttons";
import { PaneHeader } from "@web/components/runs/pane-header";

export function ContextPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 overflow-auto border-l border-border-subtle">
      <PaneHeader>Run context</PaneHeader>
      <div className="p-4">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 rounded-lg border border-border-subtle bg-surface-1 p-3.5 text-sm">
          <dt className="text-xs text-text-tertiary">state</dt>
          <dd className="m-0 justify-self-end">
            <RunStatusChip status={detail.run.status} />
          </dd>
          <dt className="text-xs text-text-tertiary">branch</dt>
          <dd className="m-0 min-w-0 justify-self-end truncate font-mono text-xs text-foreground">
            {detail.run.branch}
          </dd>
        </dl>
        <div className="mt-3.5 flex gap-2">
          <RunActionButtons runId={detail.run.id} status={detail.run.status} stretch />
        </div>
      </div>
    </div>
  );
}
