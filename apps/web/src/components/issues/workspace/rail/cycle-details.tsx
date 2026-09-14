import type { RunContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useRunDetail, useRunUsage } from "@web/api/runs/queries";
import { useWorkspacesForRun } from "@web/api/workspaces/queries";
import { RailDisclosure } from "@web/components/issues/workspace/rail/disclosure";
import { ExecutionSection } from "@web/components/issues/workspace/rail/execution-section";
import { FollowedRunSection } from "@web/components/issues/workspace/rail/followed-run-section";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { UsageSection } from "@web/components/issues/workspace/rail/usage-section";
import { WorkspaceSection } from "@web/components/issues/workspace/rail/workspace/section";
import { shortId } from "@web/lib/ids";
import { frozenRunExecutions } from "@web/lib/run/frozen-execution";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function CycleDetails({ runId, run }: { runId: string; run: RunContract | null }) {
  const detail = useRunDetail(runId);
  const workspaces = useWorkspacesForRun(runId);
  const usage = useRunUsage(runId);
  const workspace = workspaces.data?.entries.at(0);
  const executions = run ? frozenRunExecutions(run.plan_json) : [];
  return (
    <RailSection title="Cycle details">
      <RailDisclosure
        title="Workspace"
        summary={workspace ? WORKSPACE_STATE[workspace.state].label : "Not recorded"}
      >
        <WorkspaceSection runId={runId} />
      </RailDisclosure>
      {workspaces.isError ? (
        <Button variant="ghost" size="xs" onClick={() => void workspaces.refetch()}>
          Couldn’t refresh workspace — retry
        </Button>
      ) : null}
      {run ? (
        <>
          <RailDisclosure
            title="Run"
            summary={`${shortId(runId)}${detail.data ? ` · ${detail.data.sessions.length} sessions` : ""}`}
          >
            <FollowedRunSection run={run} />
          </RailDisclosure>
          {detail.isError ? (
            <Button variant="ghost" size="xs" onClick={() => void detail.refetch()}>
              Couldn’t refresh run — retry
            </Button>
          ) : null}
          <RailDisclosure
            title="Execution"
            summary={executions
              .map((execution) => execution.runtime.label)
              .filter((value, index, values) => values.indexOf(value) === index)
              .join(" · ")}
          >
            <ExecutionSection run={run} />
          </RailDisclosure>
          <RailDisclosure
            title="Usage"
            summary={usage.data ? `${usage.data.total.turns} turns reported` : "Not reported"}
          >
            <UsageSection runId={run.id} />
          </RailDisclosure>
          {usage.isError ? (
            <Button variant="ghost" size="xs" onClick={() => void usage.refetch()}>
              Couldn’t refresh usage — retry
            </Button>
          ) : null}
        </>
      ) : null}
    </RailSection>
  );
}
