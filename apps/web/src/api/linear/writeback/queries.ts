import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { readDataUrl } from "@web/lib/data-url";

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

export function useLinearAttachments(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearAttachments(issueId),
    queryFn: () => daemon.getLinearAttachments(issueId),
    retry: false,
    staleTime: 15_000,
  });
}

/** An upload's bytes never change under their URL, so a fetched file stays fresh for its cache life. */
export function useLinearMedia(issueId: string, url: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearMedia(issueId, url),
    queryFn: async () => {
      const blob = await daemon.getLinearMedia(issueId, url);
      return { src: await readDataUrl(blob), type: blob.type, size: blob.size };
    },
    retry: false,
    staleTime: Infinity,
  });
}
