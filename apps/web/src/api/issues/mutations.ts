import { DaemonRequestError } from "@otomat/client";
import type { CreateIssueRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Creates a local issue without launching a run. On success invalidates the issues cache. */
export function useCreateIssue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateIssueRequest) => daemon.createIssue(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.issues });
    },
  });
}

function createIssueErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    return error.status >= 500
      ? "Could not create issue — the daemon failed to save it."
      : "Could not create issue — the request was rejected.";
  }
  return "Could not create issue — is the daemon running?";
}

export interface CreateIssueAndNavigate {
  /** Resolves true when the issue was created and navigation fired; false when it failed (an error toast was shown). */
  create: (request: CreateIssueRequest) => Promise<boolean>;
  isPending: boolean;
}

/** Creates the issue and, on success, toasts and opens its workspace; on failure shows an error toast. */
export function useCreateIssueAndNavigate(): CreateIssueAndNavigate {
  const createIssue = useCreateIssue();
  const navigate = useNavigate();

  async function create(request: CreateIssueRequest): Promise<boolean> {
    try {
      const issue = await createIssue.mutateAsync(request);
      toast.success("Issue created");
      navigate({ to: "/issues/$issueId", params: { issueId: issue.id } });
      return true;
    } catch (error) {
      toast.error(createIssueErrorMessage(error));
      return false;
    }
  }

  return { create, isPending: createIssue.isPending };
}
