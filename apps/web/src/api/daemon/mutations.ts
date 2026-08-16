import type { ExecutionDefaults } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useSaveExecutionDefaults() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (defaults: ExecutionDefaults) => daemon.setExecutionDefaults(defaults),
    onSuccess: (saved) => client.setQueryData(queryKeys.executionDefaults, saved),
  });
}

export function useSavePullRequestGenerator() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (generator: ExecutionDefaults) => daemon.setPullRequestGenerator(generator),
    onSuccess: (saved) => client.setQueryData(queryKeys.pullRequestGenerator, saved),
  });
}
