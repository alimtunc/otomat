import type { ExecutionDefaults } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useSaveExecutionDefaults() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (defaults: ExecutionDefaults) => daemon.setExecutionDefaults(defaults),
    onSuccess: (saved) => client.setQueryData(keys.executionDefaults, saved),
  });
}

export function useSavePullRequestGenerator() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (generator: ExecutionDefaults) => daemon.setPullRequestGenerator(generator),
    onSuccess: (saved) => client.setQueryData(keys.pullRequestGenerator, saved),
  });
}
