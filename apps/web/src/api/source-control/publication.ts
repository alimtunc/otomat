import type { PublishRepositoryPullRequest, RepositoryPullRequestInput } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useQueryKeys } from "@web/api/use-query-keys";

export function usePublishRepositoryPullRequest(repositoryId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: PublishRepositoryPullRequest) =>
      daemon.publishRepositoryPullRequest(repositoryId, request),
    onSuccess: (pullRequest) => {
      client.setQueryData(keys.pullRequest(pullRequest.id), {
        pull_request: pullRequest,
        issue: null,
      });
      void client.invalidateQueries({ queryKey: keys.reviews });
      void client.invalidateQueries({ queryKey: keys.inbox });
    },
    onSettled: () => invalidateCheckout(client, keys, { kind: "repository", id: repositoryId }),
  });
}

export function useGenerateRepositoryPullRequest(repositoryId: string) {
  return useMutation({
    mutationFn: (request: RepositoryPullRequestInput) =>
      daemon.generateRepositoryPullRequest(repositoryId, request),
  });
}
