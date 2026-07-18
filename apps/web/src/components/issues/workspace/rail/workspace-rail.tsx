import type { IssueContract, RunContract } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import { FollowedRunSection } from "@web/components/issues/workspace/rail/followed-run-section";
import { PullRequestSection } from "@web/components/issues/workspace/rail/pull-request-section";
import {
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { UsageSection } from "@web/components/issues/workspace/rail/usage-section";

/**
 * Right rail of the issue workspace. The run-scoped sections read the followed
 * run and must render inside its RunEventsProvider; with no run the rail shows
 * only the issue's properties.
 */
export function WorkspaceRail({ issue, run }: { issue: IssueContract; run: RunContract | null }) {
  return (
    <aside className="min-w-0 overflow-auto border-t border-border-subtle p-4 lg:border-l lg:border-t-0">
      <RailSection title="Properties" last={run === null}>
        <RailMeta>
          <RailRow label="Status">
            <IssueStatusChip status={issue.status} />
          </RailRow>
          <RailRow label="Source">
            <span className="text-text-secondary">{issue.source}</span>
          </RailRow>
          <RailRow label="External id">
            {issue.source_external_id !== null ? (
              <span className="truncate font-mono text-xs text-text-secondary">
                {issue.source_external_id}
              </span>
            ) : (
              <Unknown />
            )}
          </RailRow>
        </RailMeta>
      </RailSection>
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
