import { EmptyState, Pill, PillTabs, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream, type RunStreamState } from "@web/api/runs/run-events-provider";
import {
  countMatching,
  LOG_FILTERS,
  matchesLogFilter,
  type LogFilter,
} from "@web/components/runs/logs/log-filters";
import { LogRow } from "@web/components/runs/logs/log-row";
import { SessionsPanel } from "@web/components/runs/logs/sessions-panel";
import { PaneHeader } from "@web/components/runs/pane-header";
import { emptyTimelineContent } from "@web/components/runs/timeline/copy";
import { CenteredState } from "@web/components/shell/centered-state";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import { useState } from "react";

const STREAM_LABEL: Record<RunStreamState, string> = {
  connecting: "connecting…",
  open: "live",
  closed: "stream ended",
  error: "stream error",
};

export function RunLogsView() {
  const { runId } = useParams({ from: "/runs/$runId/logs" });
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();
  const [filter, setFilter] = useState<LogFilter>("all");

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
      <DaemonUnreachableState
        title="Couldn’t load this run"
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const filtered = stream.events.filter((event) => matchesLogFilter(event, filter));
  const empty = emptyTimelineContent(stream.state === "error", stream.degraded);

  let logList;
  if (stream.events.length === 0) {
    logList = (
      <CenteredState fill="flex">
        <EmptyState
          icon="terminal"
          tone={empty.tone}
          title={empty.title}
          description={empty.description}
        />
      </CenteredState>
    );
  } else if (filtered.length === 0) {
    logList = (
      <CenteredState fill="flex">
        <EmptyState
          icon="terminal"
          title="No matching events"
          description="No persisted event matches this filter for the run so far."
        />
      </CenteredState>
    );
  } else {
    logList = (
      <div role="list" aria-label="Run logs" className="min-h-0 flex-1 overflow-auto py-2">
        {filtered.map((event) => (
          <LogRow key={event.seq} event={event} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SessionsPanel detail={detail.data} />
      <PaneHeader>
        Logs
        <span className="ml-auto font-normal normal-case text-text-tertiary">
          from the persisted ledger · {STREAM_LABEL[stream.state]}
        </span>
      </PaneHeader>
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border-subtle px-3.5 py-2">
        <PillTabs
          type="single"
          value={filter}
          onValueChange={(value) => {
            if (value !== "") setFilter(value as LogFilter);
          }}
          aria-label="Filter log events"
          className="flex-wrap"
        >
          {LOG_FILTERS.map((entry) => {
            const count = countMatching(stream.events, entry.value);
            return (
              <Pill key={entry.value} value={entry.value} badge={count > 0 ? count : null}>
                {entry.label}
              </Pill>
            );
          })}
        </PillTabs>
      </div>
      {stream.degraded ? (
        <div
          aria-live="polite"
          className="border-b border-border-subtle px-6 py-2 text-xs text-danger"
        >
          Some events could not be decoded — this log may be incomplete.
        </div>
      ) : null}
      {logList}
    </div>
  );
}
