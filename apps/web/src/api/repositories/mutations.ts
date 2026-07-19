import { DaemonRequestError } from "@otomat/client";
import { repositoryRegistrationErrorSchema, type RegisterRepositoryRequest } from "@otomat/domain";
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

/** Preserves typed daemon refusals and falls back to a connectivity message otherwise. */
export function registerRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryRegistrationErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not register the repository — the daemon rejected the request.";
  }
  return "Could not register the repository — is the daemon running?";
}
