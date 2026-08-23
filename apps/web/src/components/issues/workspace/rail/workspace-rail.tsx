import { projectOpenCycleExecution, type IssueContract, type RunContract } from "@otomat/domain";
import { cn, SidePanelToggle, useSidePanel } from "@otomat/ui";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { LinearRailSection } from "@web/components/issues/workspace/linear/rail-section";
import { ExecutionSection } from "@web/components/issues/workspace/rail/execution-section";
import { FollowedRunSection } from "@web/components/issues/workspace/rail/followed-run-section";
import { IssuePullRequestsSection } from "@web/components/issues/workspace/rail/issue-pull-requests-section";
import { IssueStatusControl } from "@web/components/issues/workspace/rail/issue-status-control";
import { Mono } from "@web/components/issues/workspace/rail/mono";
import { PermissionSection } from "@web/components/issues/workspace/rail/permission-section";
import { ProviderWaitSection } from "@web/components/issues/workspace/rail/provider-wait-section";
import { PullRequestSection } from "@web/components/issues/workspace/rail/pull-request-section";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { StoppedSection } from "@web/components/issues/workspace/rail/stopped-section";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { UsageSection } from "@web/components/issues/workspace/rail/usage-section";
import { WorkspaceSection } from "@web/components/issues/workspace/rail/workspace/section";

function ExternalIdentifier({ identifier, url }: { identifier: string; url: string | null }) {
  const label = <Mono>{identifier}</Mono>;
  return url === null ? (
    label
  ) : (
    <a
      className="truncate font-mono text-xs text-text-secondary underline decoration-border-subtle underline-offset-2 hover:text-text-primary"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      {identifier}
    </a>
  );
}

/** The run-scoped sections read the run event stream, so this must render inside its RunEventsProvider. */
export function WorkspaceRail({ issue, run }: { issue: IssueContract; run: RunContract | null }) {
  const panel = useSidePanel();
  const cycleExecution = projectOpenCycleExecution(issue);
  const cycleRunId = issue.workspace.run_id ?? run?.id ?? null;
  return (
    <aside
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-auto bg-sidebar p-4",
        panel === null ? "border-t border-border-subtle" : null,
      )}
    >
      <RailSection
        title={
          <>
            Properties
            <SidePanelToggle className="-mr-1.5 ml-auto" />
          </>
        }
      >
        <RailMeta>
          <RailRow label="Issue status">
            <IssueStatusControl issue={issue} />
          </RailRow>
          <RailRow label="Workspace execution">
            {cycleExecution === null ? (
              <span className="text-xs text-text-tertiary">No open workspace</span>
            ) : (
              <IssueExecutionChip execution={cycleExecution} />
            )}
          </RailRow>
          <RailRow label="Source">
            <span className="text-text-secondary">{issue.source}</span>
          </RailRow>
          {issue.source === "linear" ? null : (
            <RailRow label="External id">
              {issue.source_identifier !== null ? (
                <ExternalIdentifier identifier={issue.source_identifier} url={issue.source_url} />
              ) : (
                <Unknown />
              )}
            </RailRow>
          )}
        </RailMeta>
      </RailSection>
      {cycleRunId === null ? null : <ProviderWaitSection runId={cycleRunId} />}
      <StoppedSection execution={issue.execution} />
      {cycleRunId === null ? null : <WorkspaceSection runId={cycleRunId} />}
      <IssuePullRequestsSection issueId={issue.id} />
      {issue.source === "linear" ? <LinearRailSection issue={issue} run={run} /> : null}
      {run !== null ? (
        <>
          <PullRequestSection run={run} />
          <FollowedRunSection run={run} />
          <ExecutionSection run={run} />
          <PermissionSection />
          <UsageSection runId={run.id} />
        </>
      ) : null}
    </aside>
  );
}
