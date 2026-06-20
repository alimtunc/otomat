import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useIssues() {
  return useQuery({ queryKey: queryKeys.issues, queryFn: () => daemon.listIssues() });
}

export function useIssue(issueId: string) {
  return useQuery({ queryKey: queryKeys.issue(issueId), queryFn: () => daemon.getIssue(issueId) });
}
