import type { EventEnvelope } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { isRunState } from "@web/lib/run/activity";

export function LifecycleDetail({ event }: { event: EventEnvelope }) {
  const status = event.payload["run_status"] ?? event.payload["final_status"];
  if (!isRunState(status)) return null;
  return (
    <span className="mt-1 inline-flex">
      <RunStatusChip status={status} />
    </span>
  );
}
