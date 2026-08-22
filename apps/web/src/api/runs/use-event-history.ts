import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import {
  useEventWindowHistory,
  type RunEventHistory,
} from "@web/api/runs/use-event-window-history";

export function useEventHistory(runId: string): RunEventHistory {
  return useEventWindowHistory(queryKeys.runEventWindow(runId), (params) =>
    daemon.getRunEventWindow(runId, params),
  );
}
