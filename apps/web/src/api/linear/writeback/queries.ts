import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useLinearWriteback(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearWriteback(issueId),
    queryFn: () => daemon.getLinearWriteback(issueId),
  });
}

export function useLinearEditor(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearEditor(issueId),
    queryFn: () => daemon.getLinearEditor(issueId),
    retry: false,
    staleTime: 15_000,
  });
}

export function useLinearComments(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearComments(issueId),
    queryFn: () => daemon.getLinearComments(issueId),
    retry: false,
    staleTime: 15_000,
  });
}
