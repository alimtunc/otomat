import { DaemonRequestError } from "@otomat/client";
import {
  repositoryDeletionErrorSchema,
  repositoryRegistrationErrorSchema,
  type RegisterRepositoryRequest,
  type UpdateRepositoryRequest,
} from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Registers a local repository and refreshes both project and repository catalogs. */
export function useRegisterRepository() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: RegisterRepositoryRequest) => daemon.registerRepository(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.projects });
      client.invalidateQueries({ queryKey: queryKeys.repositories });
    },
  });
}

/** Saves per-repository settings (worktree init commands) and refreshes the catalog. */
export function useUpdateRepository() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { repositoryId: string; request: UpdateRepositoryRequest }) =>
      daemon.updateRepository(input.repositoryId, input.request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.repositories });
    },
  });
}

/** Deletes a repository (and its project) and refreshes every project-scoped catalog. */
export function useDeleteRepository() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => daemon.deleteRepository(repositoryId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.projects });
      client.invalidateQueries({ queryKey: queryKeys.repositories });
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

/** Surfaces the daemon's refusal (e.g. active runs) and falls back to connectivity. */
export function deleteRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryDeletionErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not delete the repository — the daemon rejected the request.";
  }
  return "Could not delete the repository — is the daemon running?";
}

/** Preserves typed daemon refusals and falls back to a connectivity message otherwise. */
export function registerRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryRegistrationErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not register the repository — the daemon rejected the request.";
  }
  return "Could not register the repository — is the daemon running?";
}
