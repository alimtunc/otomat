import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import {
  useEventWindowHistory,
  type RunEventHistory,
} from "@web/api/runs/use-event-window-history";

export function useStepEventHistory(runId: string, stepId: string): RunEventHistory {
  return useEventWindowHistory(queryKeys.stepEventWindow(runId, stepId), (params) =>
    daemon.getStepEventWindow(runId, stepId, params),
  );
}
