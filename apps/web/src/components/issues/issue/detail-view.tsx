import { issueShortId, shortId } from "@otomat/domain";
import {
  Icon,
  cn,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  SegmentedControl,
  SegmentedItem,
  Skeleton,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useRunsForIssue } from "@web/api/runs/queries";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { userTerminalsAvailable } from "@web/api/terminals/client";
import { IssueHeader } from "@web/components/issues/issue/header";
import { CycleSummary } from "@web/components/issues/workspace/cycle-summary";
import { LaunchRunDialog } from "@web/components/issues/workspace/launch/dialog";
import { LinearCommentsSection } from "@web/components/issues/workspace/linear/comments";
import { WorkspaceRail } from "@web/components/issues/workspace/rail/workspace-rail";
import { RunActionsMenu } from "@web/components/runs/actions/run-actions-menu";
import { IconLink } from "@web/components/shell/icon-link";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { TerminalWorkspace } from "@web/components/terminal/workspace";
import { asMember } from "@web/lib/coerce";
import { resolveFollowedRun } from "@web/lib/run/activity";
import { useState } from "react";

import { RunsArea } from "./runs-area";

function RailPlaceholder() {
  return (
    <div className="flex flex-col gap-3 px-3.5 py-3">
      <Skeleton height={18} />
      <Skeleton height={18} width="70%" />
      <Skeleton height={18} width="85%" />
    </div>
  );
}

const ISSUE_TABS = ["activity", "terminal"] as const;
type IssueTab = (typeof ISSUE_TABS)[number];

export function IssueDetailView() {
  const [tab, setTab] = useState<IssueTab>("activity");
  const terminalsAvailable = userTerminalsAvailable();
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const { run: selectedRunId, step: selectedStepId } = useSearch({ from: "/issues/$issueId" });
  const navigate = useNavigate();
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const back = useBackNavigation(null);
  const followedRun = resolveFollowedRun(runs.data ?? [], selectedRunId ?? null);
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const railLayout = usePanelGroupLayout("otomat.issue-detail");

  const follow = (runId: string, stepId?: string): void => {
    void navigate({
      to: "/issues/$issueId",
      params: { issueId },
      search: { run: runId, step: stepId },
      replace: true,
    });
  };

  const selectStep = (stepId: string): void => {
    if (!followedRun) return;
    void navigate({
      to: "/issues/$issueId",
      params: { issueId },
      search: { run: followedRun.id, step: stepId },
      replace: true,
    });
  };

  const idLabel = issue.data ? issueShortId(issue.data) : shortId(issueId);
  const launchAction = (
    <LaunchRunDialog issue={issue.data} onLaunched={(run, stepId) => follow(run.id, stepId)} />
  );
  const cycleRunId = issue.data?.workspace.run_id ?? followedRun?.id ?? null;
  const terminalSelected = terminalsAvailable && tab === "terminal";

  const main = (
    <div className={cn("min-w-0 px-4 py-6.5 sm:px-8", wide && "h-full overflow-auto")}>
      <div className="flex max-w-180 flex-col gap-4">
        <IssueHeader
          query={issue}
          hasRun={runs.data === undefined && !runs.isError ? null : followedRun !== null}
          comments={
            issue.data?.source === "linear" ? (
              <LinearCommentsSection
                key={issueId}
                issueId={issueId}
                runId={followedRun?.id ?? null}
              />
            ) : null
          }
        >
          {followedRun ? (
            <CycleSummary run={followedRun} selectedStepId={selectedStepId ?? null} />
          ) : null}
        </IssueHeader>
        <section
          id="issue-conversations"
          tabIndex={-1}
          className={cn("flex min-w-0 flex-col", followedRun && "h-[max(40rem,75svh)] shrink-0")}
        >
          <RunsArea
            query={runs}
            launchAction={launchAction}
            followedRun={followedRun}
            onFollow={follow}
            selectedStepId={selectedStepId ?? null}
            onSelectStep={selectStep}
          />
        </section>
      </div>
    </div>
  );
  const rail = issue.data ? <WorkspaceRail issue={issue.data} run={followedRun} /> : null;

  const body = wide ? (
    <ResizablePanelGroup {...railLayout} className="h-full min-h-0">
      <ResizablePanel id="issue" minSize="40%">
        {main}
      </ResizablePanel>
      <SidePanel
        id="issue-rail"
        label="Issue details"
        side="right"
        defaultSize={300}
        minSize={240}
        maxSize="36%"
      >
        {rail ?? <RailPlaceholder />}
      </SidePanel>
    </ResizablePanelGroup>
  ) : (
    <div className="h-full">
      {main}
      {rail}
    </div>
  );

  return (
    <RouteShell
      back={back}
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: idLabel, current: true },
      ]}
      tabs={
        terminalsAvailable ? (
          <SegmentedControl
            type="single"
            value={tab}
            onValueChange={(value) => {
              const next = asMember(value, ISSUE_TABS);
              if (next !== null) setTab(next);
            }}
            aria-label="Issue workspace tabs"
          >
            <SegmentedItem value="activity">Activity</SegmentedItem>
            <SegmentedItem value="terminal" icon={<Icon name="terminal" aria-hidden />}>
              Terminal
            </SegmentedItem>
          </SegmentedControl>
        ) : null
      }
      actions={
        terminalSelected ? null : (
          <>
            {followedRun ? (
              <IconLink
                label="Open cockpit"
                icon={<Icon name="monitor" aria-hidden />}
                to="/runs/$runId"
                params={{ runId: followedRun.id }}
                search={{ step: selectedStepId }}
              />
            ) : null}
            {launchAction}
            {cycleRunId ? <RunActionsMenu runId={cycleRunId} /> : null}
          </>
        )
      }
    >
      <RunEventsProvider runId={followedRun?.id ?? null}>
        {terminalSelected ? (
          <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
            <h1 className="shrink-0 truncate text-sm font-medium" title={issue.data?.title}>
              {issue.data?.title ?? idLabel}
            </h1>
            <div className="min-h-0 flex-1">
              <TerminalWorkspace issueId={issueId} runId={null} />
            </div>
          </div>
        ) : (
          body
        )}
      </RunEventsProvider>
    </RouteShell>
  );
}
