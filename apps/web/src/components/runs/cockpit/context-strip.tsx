import type { RunDetail } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { RunActionButtons } from "@web/components/runs/cockpit/run/action-buttons";
import { RunWaitNote } from "@web/components/runs/cockpit/run/wait-note";
import { CopyablePath } from "@web/components/runs/copyable-path";

/** The narrow-viewport stand-in for the context pane: branch and worktree keep one stable line each, never sharing one. */
export function ContextStrip({ detail }: { detail: RunDetail }) {
  return (
    <div className="flex flex-none flex-col gap-1 border-b border-border-subtle bg-surface-1 px-3.5 py-2">
      <div className="flex items-center gap-2.5">
        <RunStatusChip status={detail.run.status} />
        <RunWaitNote wait={detail.wait} />
        <span className="ml-auto flex-none">
          <RunActionButtons runId={detail.run.id} issueId={detail.run.issue_id} />
        </span>
      </div>
      <CopyablePath value={detail.run.branch} label="branch" />
      {detail.worktree_path === null ? null : (
        <CopyablePath value={detail.worktree_path} label="worktree path" />
      )}
    </div>
  );
}
