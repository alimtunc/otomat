import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Issues for the selected project; disabled while no project is selected. */
export function useProjectIssues(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issuesList(projectId),
    queryFn: () => daemon.listIssues({ projectId }),
    enabled: projectId !== undefined,
  });
}

export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: queryKeys.issue(issueId ?? ""),
    queryFn: issueId === null ? skipToken : () => daemon.getIssue(issueId),
  });
}
