import { DaemonRequestError } from "@otomat/client";
import { repositoryRegistrationErrorSchema, type RegisterRepositoryRequest } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Registers a local repository; on success invalidates the projects + repositories caches so the switcher and Settings refresh. */
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

/** The daemon's own safe refusal message when it sent one; honest fallbacks otherwise. */
export function registerRepositoryErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = repositoryRegistrationErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not register the repository — the daemon rejected the request.";
  }
  return "Could not register the repository — is the daemon running?";
}
