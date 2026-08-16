import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useWorkflowPresets(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workflowPresetsFor(projectId),
    queryFn: () => daemon.listWorkflowPresets(projectId),
  });
}
