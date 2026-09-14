import { issueShortId, projectOpenCycleExecution, type IssueContract } from "@otomat/domain";
import { Chip, IssueSourceGlyph, IssueStatusChip } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";

export function IssueMetadata({
  issue,
  linearState,
}: {
  issue: IssueContract;
  linearState?: { name: string; color: string };
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
          <ColorDot color={linearState.color} />
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
