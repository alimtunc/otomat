import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Issues of the selected project; unscoped when `projectId` is undefined (e.g. the command palette). */
export function useIssues(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.issuesList(projectId),
    queryFn: () => daemon.listIssues(projectId ? { projectId } : {}),
  });
}

export function useIssue(issueId: string) {
  return useQuery({ queryKey: queryKeys.issue(issueId), queryFn: () => daemon.getIssue(issueId) });
}
