import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useWorkflowPresets(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.workflowPresetsFor(projectId),
    queryFn: () => daemon.listWorkflowPresets(projectId),
  });
}
