import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** All issues across projects, used by global surfaces such as the command palette. */
export function useIssues() {
  return useQuery({ queryKey: queryKeys.allIssues, queryFn: () => daemon.listIssues() });
}

/** Issues for the selected project; disabled while no project is selected. */
export function useProjectIssues(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issuesList(projectId),
    queryFn: () => daemon.listIssues({ projectId }),
    enabled: projectId !== undefined,
  });
}

export function useIssue(issueId: string) {
  return useQuery({ queryKey: queryKeys.issue(issueId), queryFn: () => daemon.getIssue(issueId) });
}
