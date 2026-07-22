import type {
  PublishCommentRequest,
  PublishFieldsRequest,
  PublishPrLinkRequest,
  PublishStatusRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";

import { invalidateWriteback } from "./cache";
import { reportUnlessHandled } from "./errors";

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
