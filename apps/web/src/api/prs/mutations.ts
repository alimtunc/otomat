import type { PreparePullRequestRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useConnectGitHub() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.connectGitHub(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.githubConnection });
      toast.success("GitHub login opened in your browser");
    },
    onError: () => toast.error("Could not start GitHub login — is the daemon running?"),
  });
}

export function usePreparePullRequest(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PreparePullRequestRequest) => daemon.preparePullRequest(runId, request),
    onSuccess: (detail) => {
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      const pullRequest = detail.pull_request;
      if (pullRequest?.status === "merged" || pullRequest?.status === "closed") {
        toast.success(`Pull request #${pullRequest.number} is ${pullRequest.status}`);
        return;
      }
      if (pullRequest?.publication_status === "created") {
        toast.success(`Pull request #${pullRequest.number} is ready`);
        return;
      }
      if (pullRequest?.error_message) {
        toast.error(pullRequest.error_message);
      }
    },
    onError: () => toast.error("Could not publish the pull request — is the daemon running?"),
  });
}
