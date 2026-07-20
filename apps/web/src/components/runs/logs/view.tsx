import { Pill, PillTabs, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { LogList } from "@web/components/runs/logs/list";
import { countMatching, LOG_FILTERS, type LogFilter } from "@web/components/runs/logs/log-filters";
import { SessionsPanel } from "@web/components/runs/logs/sessions-panel";
import { PaneHeader } from "@web/components/runs/pane-header";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import { STREAM_LABEL } from "@web/lib/run-stream";
import { useState } from "react";

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
      <LogList
        events={stream.events}
        filter={filter}
        state={stream.state}
        degraded={stream.degraded}
      />
    </div>
  );
}
