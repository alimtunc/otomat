import type { RunDetail } from "@otomat/domain";
import { StatusGlyph } from "@otomat/ui";
import { AddStepDialog } from "@web/components/runs/actions/add-step-dialog";
import { settledRunNote } from "@web/lib/run/contribution";

export function RunClosureBar({ detail }: { detail: RunDetail }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2.5 border-t border-border-subtle p-3"
    >
      <StatusGlyph kind="run" status={detail.run.status} />
      <p className="min-w-0 flex-1 text-xs text-text-secondary">
        {settledRunNote(detail.run.status)}
      </p>
      <AddStepDialog issueId={detail.run.issue_id} />
    </div>
  );
}
