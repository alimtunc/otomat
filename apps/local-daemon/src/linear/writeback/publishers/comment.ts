import type { PublishCommentRequest } from "@otomat/domain";

import { requireWritableIssue } from "../issue.js";
import type { LinearWriteLedger } from "../ledger.js";
import type { LinearWritebackConfig } from "../types.js";

function commentDetail(body: string): string {
  const firstLine = body.trim().split("\n", 1)[0] ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

export async function publishComment(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
  request: PublishCommentRequest,
): Promise<void> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const key = request.client_id;
  const existing = ledger.findByIdentity(issueId, "comment", key);
  if (existing?.status === "sent" || (existing && ledger.isActive(existing))) return;
  const parentId = request.parent_id ?? null;
  const write = ledger.ensurePending(existing, {
    issueId,
    runId: request.run_id ?? null,
    kind: "comment",
    key,
    payload: { body: request.body, parent_id: parentId },
    detail: commentDetail(request.body),
  });
  await ledger.run(write, async (apiKey, signal) => {
    const remoteComments = await config.client.listComments(apiKey, linearId, signal);
    const remoteId = remoteComments.some((comment) => comment.id === key)
      ? key
      : await config.client.createComment(
          apiKey,
          {
            id: key,
            issueId: linearId,
            body: request.body,
            ...(parentId === null ? {} : { parentId }),
          },
          signal,
        );
    return { remote_id: remoteId, detail: commentDetail(request.body) };
  });
}
