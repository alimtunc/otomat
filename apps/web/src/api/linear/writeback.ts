import { DaemonRequestError } from "@otomat/client";
import {
  linearWriteConflictSchema,
  type LinearWriteConflict,
  type LinearWritebackState,
  type PublishCommentRequest,
  type PublishFieldsRequest,
  type PublishPrLinkRequest,
  type PublishStatusRequest,
  type SaveLinearDraftRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { isSupersededLinearError, linearErrorMessage } from "@web/api/linear/mutations";
import { queryKeys } from "@web/api/query-keys";

/** The 409 body of a blocked fields publish, carrying the current remote values. */
export function linearWriteConflict(error: unknown): LinearWriteConflict | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const parsed = linearWriteConflictSchema.safeParse(error.body);
  return parsed.success ? parsed.data : null;
}

function invalidateWriteback(client: QueryClient, issueId: string): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.linearWriteback(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.linearEditor(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.linearComments(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.issue(issueId) }),
  ]);
}

function reportUnlessHandled(error: unknown): void {
  if (isSupersededLinearError(error) || linearWriteConflict(error) !== null) return;
  toast.error(linearErrorMessage(error));
}

export function useLinearWriteback(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearWriteback(issueId),
    queryFn: () => daemon.getLinearWriteback(issueId),
  });
}

export function useLinearEditor(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearEditor(issueId),
    queryFn: () => daemon.getLinearEditor(issueId),
    retry: false,
    staleTime: 15_000,
  });
}

export function useLinearComments(issueId: string) {
  return useQuery({
    queryKey: queryKeys.linearComments(issueId),
    queryFn: () => daemon.getLinearComments(issueId),
    retry: false,
    staleTime: 15_000,
  });
}

// Drafts are replaced whole from the last-known values, so rapid successive edits
// must see each other synchronously: patch the cache on mutate, roll back on error.
function useOptimisticWriteback<TRequest>(
  issueId: string,
  apply: (current: LinearWritebackState | undefined, request: TRequest) => LinearWritebackState,
) {
  const client = useQueryClient();
  const key = queryKeys.linearWriteback(issueId);
  return {
    client,
    onMutate: async (request: TRequest) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<LinearWritebackState>(key);
      client.setQueryData<LinearWritebackState>(key, (current) => apply(current, request));
      return { previous };
    },
    onError: (
      error: unknown,
      _request: TRequest,
      context: { previous?: LinearWritebackState } | undefined,
    ) => {
      if (context?.previous !== undefined) client.setQueryData(key, context.previous);
      reportUnlessHandled(error);
    },
  };
}

export function useSaveLinearDraft(issueId: string) {
  const optimistic = useOptimisticWriteback(
    issueId,
    (current, request: SaveLinearDraftRequest) => ({
      writes: current?.writes ?? [],
      draft: {
        id: current?.draft?.id ?? "optimistic",
        issue_id: issueId,
        base_updated_at: request.base_updated_at,
        title: request.title,
        description: request.description,
        priority: request.priority,
        assignee_id: request.assignee_id,
        label_ids: request.label_ids,
        updated_at: current?.draft?.updated_at ?? new Date().toISOString(),
      },
    }),
  );
  return useMutation({
    mutationFn: (request: SaveLinearDraftRequest) => daemon.saveLinearDraft(issueId, request),
    onMutate: optimistic.onMutate,
    onError: optimistic.onError,
    onSettled: () => invalidateWriteback(optimistic.client, issueId),
  });
}

export function useDiscardLinearDraft(issueId: string) {
  const optimistic = useOptimisticWriteback<void>(issueId, (current) => ({
    writes: current?.writes ?? [],
    draft: null,
  }));
  return useMutation({
    mutationFn: () => daemon.discardLinearDraft(issueId),
    onMutate: optimistic.onMutate,
    onError: optimistic.onError,
    onSettled: () => invalidateWriteback(optimistic.client, issueId),
  });
}

export function usePublishLinearFields(issueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PublishFieldsRequest) => daemon.publishLinearFields(issueId, request),
    onError: reportUnlessHandled,
    onSettled: () => invalidateWriteback(client, issueId),
  });
}

export function usePublishLinearStatus(issueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PublishStatusRequest) => daemon.publishLinearStatus(issueId, request),
    onSuccess: () => toast.success("Published status to Linear"),
    onError: reportUnlessHandled,
    onSettled: () => invalidateWriteback(client, issueId),
  });
}

export function usePublishLinearComment(issueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PublishCommentRequest) => daemon.publishLinearComment(issueId, request),
    onSuccess: () => toast.success("Posted comment to Linear"),
    onError: reportUnlessHandled,
    onSettled: () => invalidateWriteback(client, issueId),
  });
}

export function usePublishLinearPrLink(issueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PublishPrLinkRequest) => daemon.publishLinearPrLink(issueId, request),
    onSuccess: () => toast.success("Attached the pull request to Linear"),
    onError: reportUnlessHandled,
    onSettled: () => invalidateWriteback(client, issueId),
  });
}

export function useRetryLinearWrite(issueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (writeId: string) => daemon.retryLinearWrite(writeId),
    onError: reportUnlessHandled,
    onSettled: () => invalidateWriteback(client, issueId),
  });
}
