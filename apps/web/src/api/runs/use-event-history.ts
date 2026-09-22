import { runEventWindowOptions } from "@web/api/runs/event-window";
import {
  useEventWindowHistory,
  type RunEventHistory,
} from "@web/api/runs/use-event-window-history";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useEventHistory(runId: string | null): RunEventHistory {
  const keys = useQueryKeys();
  return useEventWindowHistory(runEventWindowOptions(keys, runId));
}
