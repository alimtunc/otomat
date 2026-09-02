import { daemon } from "@web/api/client";
import {
  useEventWindowHistory,
  type RunEventHistory,
} from "@web/api/runs/use-event-window-history";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useStepEventHistory(runId: string, stepId: string): RunEventHistory {
  const keys = useQueryKeys();
  return useEventWindowHistory(keys.stepEventWindow(runId, stepId), (params) =>
    daemon.getStepEventWindow(runId, stepId, params),
  );
}
