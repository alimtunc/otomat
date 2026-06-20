import type { EventEnvelope, RunDetail } from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  RunStatusChip,
  SegmentedControl,
  SegmentedItem,
  SessionStatusChip,
  Skeleton,
  StepStatusChip,
  TimelineEventRow,
} from "@otomat/ui";
import { Link, Outlet, useMatchRoute, useParams } from "@tanstack/react-router";
import { GitCompare, ListTree, Loader } from "lucide-react";

import { eventSummary, mergeEventsBySeq } from "../lib/events";
import { useRunDetail, useRunEvents, type RunStreamState } from "../lib/queries";
import { RouteShell } from "./shell";

function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const onDiff = !!matchRoute({ to: "/runs/$runId/diff" });
  const value = onDiff ? "diff" : "timeline";
  return (
    <SegmentedControl type="single" value={value} aria-label="Run cockpit tabs">
      <SegmentedItem
        value="timeline"
        icon={<ListTree />}
        render={<Link to="/runs/$runId" params={{ runId }} />}
      >
        Timeline
      </SegmentedItem>
      <SegmentedItem
        value="diff"
        icon={<GitCompare />}
        render={<Link to="/runs/$runId/diff" params={{ runId }} />}
      >
        Diff
      </SegmentedItem>
    </SegmentedControl>
  );
}

export function RunCockpitRoute() {
  const { runId } = useParams({ from: "/runs/$runId" });
  return (
    <RouteShell
      active="runs"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: `Run ${runId.slice(0, 8)}`, current: true },
      ]}
      actions={<CockpitTabs runId={runId} />}
    >
      <Outlet />
    </RouteShell>
  );
}

export function RunTimelineRoute() {
  const { runId } = useParams({ from: "/runs/$runId" });
  const detail = useRunDetail(runId);
  const stream = useRunEvents(runId);

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <Skeleton height={20} width="40%" />
        <Skeleton height={14} width="64%" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <ErrorState
          title="Couldn’t load this run"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void detail.refetch()}
        />
      </div>
    );
  }

  const events = mergeEventsBySeq(detail.data.events, stream.events);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunStatusBar detail={detail.data} />
      <RunTimeline events={events} state={stream.state} />
    </div>
  );
}

function RunStatusBar({ detail }: { detail: RunDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-6 py-3">
      <RunStatusChip status={detail.run.status} />
      {detail.steps.map((step) => (
        <StepStatusChip key={step.id} status={step.status} />
      ))}
      {detail.sessions.map((session) => (
        <SessionStatusChip key={session.id} status={session.status} />
      ))}
    </div>
  );
}

function RunTimeline({ events, state }: { events: EventEnvelope[]; state: RunStreamState }) {
  const isError = state === "error";

  if (events.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          icon={Loader}
          tone={isError ? "error" : "neutral"}
          title={isError ? "Stream interrupted" : "Waiting to start"}
          description={
            isError
              ? "The event stream dropped. It reconnects automatically."
              : "No events yet. The run timeline streams from the daemon over SSE."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto py-2" role="list">
      {events.map((event) => (
        <TimelineEventRow
          key={event.seq}
          type={event.type}
          provenance={event.source}
          summary={eventSummary(event)}
          at={event.occurred_at}
        />
      ))}
    </div>
  );
}

export function RunDiffRoute() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={GitCompare}
        title="No changes yet"
        description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
      />
    </div>
  );
}
