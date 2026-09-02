import { daemon } from "@web/api/client";
import {
  useEventWindowHistory,
  type RunEventHistory,
} from "@web/api/runs/use-event-window-history";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useEventHistory(runId: string): RunEventHistory {
  const keys = useQueryKeys();
  return useEventWindowHistory(keys.runEventWindow(runId), (params) =>
    daemon.getRunEventWindow(runId, params),
  );
}
