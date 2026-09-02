import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useProjectIssues(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.issuesList(projectId),
    queryFn: () => daemon.listIssues({ projectId }),
    enabled: projectId !== undefined,
  });
}

export function useIssue(issueId: string | null) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.issue(issueId ?? ""),
    queryFn: issueId === null ? skipToken : () => daemon.getIssue(issueId),
  });
}
