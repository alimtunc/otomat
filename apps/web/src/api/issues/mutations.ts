import { DaemonRequestError } from "@otomat/client";
import {
  issueProjectMoveErrorSchema,
  issueStatusErrorSchema,
  type CreateIssueRequest,
  type MoveIssueProjectRequest,
  type SetIssueStatusRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useCreateIssue() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateIssueRequest) => daemon.createIssue(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.issues });
    },
  });
}

export function useMoveIssueProject(issueId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: MoveIssueProjectRequest) => daemon.moveIssueProject(issueId, request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.issues });
      client.invalidateQueries({ queryKey: keys.repositories });
    },
  });
}

/** The daemon refuses this for a mirrored issue. */
export function useSetIssueStatus(issueId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SetIssueStatusRequest) => daemon.setIssueStatus(issueId, request),
    onSuccess: (issue) => {
      client.setQueryData(keys.issue(issue.id), issue);
      client.invalidateQueries({ queryKey: keys.issues });
    },
  });
}

export function issueStatusErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = issueStatusErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not change this status — the daemon rejected the request.";
  }
  return "Could not change this status — is the daemon running?";
}

export function moveIssueProjectErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = issueProjectMoveErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not move this issue — the daemon rejected the request.";
  }
  return "Could not move this issue — is the daemon running?";
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
  /** False when the create failed; an error toast was already shown. */
  create: (request: CreateIssueRequest) => Promise<boolean>;
  isPending: boolean;
}

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
