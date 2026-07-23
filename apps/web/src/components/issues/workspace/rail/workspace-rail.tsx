import type { IssueContract, RunContract } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { LinearRailSection } from "@web/components/issues/workspace/linear/rail-section";
import { FollowedRunSection } from "@web/components/issues/workspace/rail/followed-run-section";
import { PullRequestSection } from "@web/components/issues/workspace/rail/pull-request-section";
import {
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { UsageSection } from "@web/components/issues/workspace/rail/usage-section";

function ExternalIdentifier({ identifier, url }: { identifier: string; url: string | null }) {
  const label = (
    <span className="truncate font-mono text-xs text-text-secondary">{identifier}</span>
  );
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

/**
 * Right rail of the issue workspace. The run-scoped sections read the followed
 * run and must render inside its RunEventsProvider; with no run the rail shows
 * only the issue's properties.
 */
export function WorkspaceRail({ issue, run }: { issue: IssueContract; run: RunContract | null }) {
  return (
    <aside className="min-w-0 overflow-auto border-t border-border-subtle bg-sidebar p-4 lg:border-l lg:border-t-0">
      <RailSection title="Properties">
        <RailMeta>
          <RailRow label="Status">
            <IssueStatusChip status={issue.status} />
          </RailRow>
          <RailRow label="Execution">
            {issue.execution.state === "none" ? (
              <span className="text-xs text-text-tertiary">No active run</span>
            ) : (
              <IssueExecutionChip execution={issue.execution} />
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
      {issue.source === "linear" ? <LinearRailSection issue={issue} run={run} /> : null}
      {run !== null ? (
        <>
          <PullRequestSection run={run} />
          <FollowedRunSection run={run} />
          <UsageSection />
        </>
      ) : null}
    </aside>
  );
}
