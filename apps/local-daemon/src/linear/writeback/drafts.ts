import { deleteLinearDraft, getLinearDraft, upsertLinearDraft } from "@otomat/db";
import type { LinearIssueDraft, SaveLinearDraftRequest } from "@otomat/domain";

import { draftToContract } from "./contracts.js";
import { requireWritableIssue } from "./issue.js";
import type { LinearWritebackConfig } from "./types.js";

export function saveDraft(
  config: LinearWritebackConfig,
  issueId: string,
  request: SaveLinearDraftRequest,
): LinearIssueDraft {
  requireWritableIssue(config.db, issueId);
  const existing = getLinearDraft(config.db, issueId);
  upsertLinearDraft(config.db, {
    id: existing?.id ?? config.idFactory(),
    issue_id: issueId,
    base_updated_at: request.base_updated_at,
    title: request.title,
    description: request.description,
    priority: request.priority,
    assignee_id: request.assignee_id,
    label_ids: request.label_ids,
  });
  const saved = getLinearDraft(config.db, issueId);
  if (!saved) throw new Error(`linear draft for issue ${issueId} vanished`);
  return draftToContract(saved);
}

export function discardDraft(config: LinearWritebackConfig, issueId: string): void {
  deleteLinearDraft(config.db, issueId);
}
