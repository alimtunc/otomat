import { DaemonRequestError } from "@otomat/client";
import {
  repositoryDeletionErrorSchema,
  repositoryRegistrationErrorSchema,
  type RegisterRepositoryRequest,
  type RepositoryContract,
  type UpdateRepositoryRequest,
} from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useRegisterRepository() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: RegisterRepositoryRequest) => daemon.registerRepository(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.projects });
      client.invalidateQueries({ queryKey: keys.repositories });
    },
  });
}

export function useUpdateRepository() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { repositoryId: string; request: UpdateRepositoryRequest }) =>
      daemon.updateRepository(input.repositoryId, input.request),
    onSuccess: (updated) => {
      const replace = (rows: RepositoryContract[] | undefined) =>
        rows?.map((row) => (row.id === updated.id ? updated : row));
      client.setQueryData(keys.repositories, replace);
      client.setQueryData(keys.repositoriesFor(updated.project_id), replace);
      client.invalidateQueries({ queryKey: keys.repositories });
    },
  });
}

export function deleteRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryDeletionErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not delete the repository — the daemon rejected the request.";
  }
  return "Could not delete the repository — is the daemon running?";
}

export function registerRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryRegistrationErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not register the repository — the daemon rejected the request.";
  }
  return "Could not register the repository — is the daemon running?";
}
