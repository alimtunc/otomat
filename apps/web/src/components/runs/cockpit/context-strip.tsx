import type { RunDetail } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { RunActionButtons } from "@web/components/runs/cockpit/run-action-buttons";
import { RunWaitNote } from "@web/components/runs/cockpit/run-wait-note";

export function ContextStrip({ detail }: { detail: RunDetail }) {
  return (
    <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border-subtle bg-surface-1 px-3.5">
      <RunStatusChip status={detail.run.status} />
      <RunWaitNote wait={detail.wait} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
        {detail.run.branch}
      </span>
      <RunActionButtons runId={detail.run.id} issueId={detail.run.issue_id} />
    </div>
  );
}
