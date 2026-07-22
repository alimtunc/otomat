import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useLinearWriteback(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearWriteback(issueId),
    queryFn: () => daemon.getLinearWriteback(issueId),
  });
}

export function useLinearEditor(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearEditor(issueId),
    queryFn: () => daemon.getLinearEditor(issueId),
    retry: false,
    staleTime: 15_000,
  });
}

export function useLinearComments(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearComments(issueId),
    queryFn: () => daemon.getLinearComments(issueId),
    retry: false,
    staleTime: 15_000,
  });
}
