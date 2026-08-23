import type { EventEnvelope } from "@otomat/domain";
import { useRef } from "react";

export function useStepActivity(
  events: readonly EventEnvelope[],
  selectedStepId: string | null,
): (stepId: string) => boolean {
  const seen = useRef<Map<string, number> | null>(null);
  const latest = new Map<string, number>();
  for (const event of events) {
    if (event.step_run_id !== null) latest.set(event.step_run_id, event.seq);
  }
  if (seen.current === null) {
    // The stream's opening replay is history, not news; the baseline waits for it.
    if (latest.size > 0) seen.current = new Map(latest);
  } else if (selectedStepId !== null) {
    const current = latest.get(selectedStepId);
    if (current !== undefined) seen.current.set(selectedStepId, current);
  }
  const read = seen.current;
  return (stepId) => {
    if (read === null || stepId === selectedStepId) return false;
    const newest = latest.get(stepId);
    return newest !== undefined && newest > (read.get(stepId) ?? -1);
  };
}
