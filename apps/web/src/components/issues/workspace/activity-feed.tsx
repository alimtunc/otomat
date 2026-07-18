import type { RunContract } from "@otomat/domain";
import { LiveDot } from "@otomat/ui";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { RunTimeline } from "@web/components/runs/timeline/list";
import { shortId } from "@web/lib/ids";
import { isActiveRun } from "@web/lib/run-activity";

function streamLabel(state: "connecting" | "open" | "closed" | "error"): string {
  if (state === "open") return "live";
  if (state === "connecting") return "connecting…";
  if (state === "closed") return "ended";
  return "stream error";
}

/**
 * Chronological feed of the followed run's persisted ledger events, streamed
 * over the run's single SSE connection (full replay on connect, so refresh and
 * daemon restart converge on the same history).
 */
export function ActivityFeed({ run }: { run: RunContract }) {
  const stream = useRunEventStream();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text-secondary">Activity</h2>
        <span className="text-xs text-text-tertiary">· run {shortId(run.id)}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
          {stream.state === "open" && isActiveRun(run) ? <LiveDot /> : null}
          {streamLabel(stream.state)}
        </span>
      </div>
      <div className="min-h-50 rounded-lg border border-border-subtle bg-card py-1">
        <RunTimeline
          events={stream.events}
          steps={run.plan_json.steps}
          state={stream.state}
          degraded={stream.degraded}
        />
      </div>
    </div>
  );
}
