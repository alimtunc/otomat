import type { IssueExecution } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { failureSummary } from "@web/lib/issue/execution-failure";

export function StoppedSection({ execution }: { execution: IssueExecution }) {
  if (execution.state !== "failed") return null;
  const { failure, run_id: runId } = execution;
  return (
    <RailSection title="Stopped">
      <RailMeta>
        <RailRow label="Reason">
          <span className="text-xs text-danger">{failureSummary(failure)}</span>
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        This issue keeps its branch, its worktree and its history. Resume the run or add a step to
        it — a new run would fork a competing workspace.
      </p>
      <div className="mt-2.5">
        <Button
          size="sm"
          className="w-full"
          render={
            <Link to="/runs/$runId/logs" params={{ runId }}>
              <Icon name="terminal" aria-hidden />
              Read the failure logs
            </Link>
          }
        />
      </div>
    </RailSection>
  );
}
