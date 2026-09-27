import {
  issueShortId,
  projectOpenCycleExecution,
  type IssueContract,
  type LinearIssueSnapshot,
} from "@otomat/domain";
import { Chip, IssueSourceGlyph, IssueStatusChip } from "@otomat/ui";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { LinearStateIcon } from "@web/components/issues/linear-state-icon";

export function IssueMetadata({
  issue,
  linearState,
}: {
  issue: IssueContract;
  linearState?: LinearIssueSnapshot["state"];
}) {
  const execution = projectOpenCycleExecution(issue);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-tertiary">
      <IssueSourceGlyph source={issue.source} />
      <span className="font-mono">{issueShortId(issue)}</span>
      <span aria-label={`Issue status: ${issue.status}`}>
        <IssueStatusChip status={issue.status} />
      </span>
      {linearState ? (
        <Chip>
          <LinearStateIcon state={linearState} />
          Linear · {linearState.name}
        </Chip>
      ) : null}
      {execution ? (
        <span aria-label={`Execution: ${execution.state}`}>
          <IssueExecutionChip execution={execution} />
        </span>
      ) : null}
    </div>
  );
}
